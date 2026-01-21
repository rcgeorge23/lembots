import type { Direction, RobotAction, RobotState } from './robot';
import type { World } from './world';
import { applyAction, getForwardPosition, type Position } from './rules';
import { TileType, isDoor, isGoal, isPressurePlate, isWall } from './world';

export type SimulationStatus = 'running' | 'won' | 'lost';

export interface Spawner {
  x: number;
  y: number;
  dir: Direction;
  count: number;
  intervalTicks: number;
}

export interface Exit {
  x: number;
  y: number;
}

export interface SimulationState {
  world: World;
  robots: RobotState[];
  spawner: Spawner;
  exits: Exit[];
  status: SimulationStatus;
  stepCount: number;
  maxSteps: number;
  requiredSaved: number;
  spawnedCount: number;
  nextSpawnTick: number | null;
  doorUnlocked: boolean;
  globalSignal: boolean;
  raftStates: RaftState[];
  jettyPositions: Position[];
}

export interface SimulationConfig {
  world: World;
  spawner: Spawner;
  exits?: Exit[];
  maxSteps?: number;
  requiredSaved?: number;
}

interface RaftState {
  x: number;
  y: number;
  route: Position[];
  dockIndex: number;
  returnIndex: number | null;
}

const isExitTile = (world: World, exits: Exit[], x: number, y: number): boolean =>
  exits.length > 0 ? exits.some((exit) => exit.x === x && exit.y === y) : isGoal(world, x, y);

const applyExitStatus = (world: World, exits: Exit[], robot: RobotState): RobotState => {
  if (robot.reachedGoal) {
    return robot;
  }

  if (isExitTile(world, exits, robot.x, robot.y)) {
    return { ...robot, reachedGoal: true };
  }

  return robot;
};

const createSpawnedRobot = (spawner: Spawner, index: number): RobotState => ({
  id: `robot-${index + 1}`,
  x: spawner.x,
  y: spawner.y,
  direction: spawner.dir,
  alive: true,
  reachedGoal: false,
});

const initializeRobots = (spawner: Spawner, world: World, exits: Exit[]): {
  robots: RobotState[];
  spawnedCount: number;
  nextSpawnTick: number | null;
} => {
  if (spawner.count <= 0) {
    return { robots: [], spawnedCount: 0, nextSpawnTick: null };
  }

  if (spawner.intervalTicks <= 0) {
    const robots = Array.from({ length: spawner.count }, (_, index) =>
      applyExitStatus(world, exits, createSpawnedRobot(spawner, index)),
    );
    return { robots, spawnedCount: spawner.count, nextSpawnTick: null };
  }

  return {
    robots: [applyExitStatus(world, exits, createSpawnedRobot(spawner, 0))],
    spawnedCount: 1,
    nextSpawnTick: spawner.intervalTicks,
  };
};

const sortPositions = (positions: Position[]): Position[] =>
  [...positions].sort((a, b) => (a.y - b.y) || (a.x - b.x));

const listPositionsForTile = (world: World, tileType: TileType): Position[] => {
  const positions: Position[] = [];
  for (let row = 0; row < world.height; row += 1) {
    for (let col = 0; col < world.width; col += 1) {
      if (world.grid[row][col] === tileType) {
        positions.push({ x: col, y: row });
      }
    }
  }
  return positions;
};

const buildRaftRoute = (origin: Position, jettyPositions: Position[]): Position[] => {
  const sortedJetties = sortPositions(jettyPositions).filter(
    (jetty) => jetty.x !== origin.x || jetty.y !== origin.y,
  );
  return [origin, ...sortedJetties];
};

const initializeRafts = (world: World, jettyPositions: Position[]): RaftState[] =>
  listPositionsForTile(world, TileType.Raft).map((raft) => ({
    ...raft,
    route: buildRaftRoute(raft, jettyPositions),
    dockIndex: 0,
    returnIndex: null,
  }));

export const createSimulation = ({
  world,
  spawner,
  exits = [],
  maxSteps = 200,
  requiredSaved = 1,
}: SimulationConfig): SimulationState => {
  const { robots, spawnedCount, nextSpawnTick } = initializeRobots(spawner, world, exits);
  const savedCount = robots.filter((robot) => robot.reachedGoal).length;
  const doorUnlocked = isPressurePlatePressed(world, robots);
  const jettyPositions = listPositionsForTile(world, TileType.Jetty);
  const raftStates = initializeRafts(world, jettyPositions);
  return {
    world,
    robots,
    spawner,
    exits,
    status: savedCount >= requiredSaved ? 'won' : 'running',
    stepCount: 0,
    maxSteps,
    requiredSaved,
    spawnedCount,
    nextSpawnTick,
    doorUnlocked,
    globalSignal: false,
    raftStates,
    jettyPositions,
  };
};

const isBlockingRobot = (robot: RobotState): boolean =>
  robot.alive && !robot.reachedGoal;

export const isPressurePlatePressed = (world: World, robots: RobotState[]): boolean =>
  robots.some((robot) => isBlockingRobot(robot) && isPressurePlate(world, robot.x, robot.y));

export const isDoorOpen = (
  world: World,
  robots: RobotState[],
  doorUnlocked = false,
): boolean => doorUnlocked || isPressurePlatePressed(world, robots);

const positionKey = (x: number, y: number): string => `${x},${y}`;

const buildOccupiedPositions = (robots: RobotState[]): Set<string> =>
  new Set(robots.filter(isBlockingRobot).map((robot) => positionKey(robot.x, robot.y)));

const isJettyPosition = (jettyPositions: Position[], x: number, y: number): boolean =>
  jettyPositions.some((jetty) => jetty.x === x && jetty.y === y);

const cloneWorldGrid = (world: World): TileType[][] => world.grid.map((row) => [...row]);

const moveRafts = (
  state: SimulationState,
  robots: RobotState[],
): {
  world: World;
  robots: RobotState[];
  raftStates: RaftState[];
} => {
  if (state.raftStates.length === 0) {
    return { world: state.world, robots, raftStates: state.raftStates };
  }

  let nextWorldGrid: TileType[][] | null = null;
  let nextRobots = robots;

  const occupied = buildOccupiedPositions(robots);
  const nextRaftStates = state.raftStates.map((raft) => {
    const robotsOnRaft = nextRobots.filter(
      (robot) =>
        isBlockingRobot(robot) && robot.x === raft.x && robot.y === raft.y,
    );
    const hasRobot = robotsOnRaft.length > 0;
    if (raft.route.length < 2) {
      return raft;
    }

    if (hasRobot) {
      const destinationIndex = (raft.dockIndex + 1) % raft.route.length;
      const destination = raft.route[destinationIndex];
      const destinationKey = positionKey(destination.x, destination.y);
      const hasBlockingAtDestination = occupied.has(destinationKey) &&
        !robotsOnRaft.some(
          (robot) => robot.x === destination.x && robot.y === destination.y,
        );
      if (hasBlockingAtDestination) {
        return raft;
      }

      if (!nextWorldGrid) {
        nextWorldGrid = cloneWorldGrid(state.world);
      }
      nextWorldGrid[raft.y][raft.x] = isJettyPosition(state.jettyPositions, raft.x, raft.y)
        ? TileType.Jetty
        : TileType.Water;
      nextWorldGrid[destination.y][destination.x] = TileType.Raft;
      occupied.delete(positionKey(raft.x, raft.y));
      occupied.add(destinationKey);

      nextRobots = nextRobots.map((robot) =>
        robot.x === raft.x && robot.y === raft.y
          ? { ...robot, x: destination.x, y: destination.y }
          : robot,
      );
      return {
        ...raft,
        x: destination.x,
        y: destination.y,
        dockIndex: destinationIndex,
        returnIndex: raft.dockIndex,
      };
    }

    if (raft.returnIndex !== null && raft.dockIndex !== raft.returnIndex) {
      const destination = raft.route[raft.returnIndex];
      const destinationKey = positionKey(destination.x, destination.y);
      if (occupied.has(destinationKey)) {
        return raft;
      }

      if (!nextWorldGrid) {
        nextWorldGrid = cloneWorldGrid(state.world);
      }
      nextWorldGrid[raft.y][raft.x] = isJettyPosition(state.jettyPositions, raft.x, raft.y)
        ? TileType.Jetty
        : TileType.Water;
      nextWorldGrid[destination.y][destination.x] = TileType.Raft;
      occupied.delete(positionKey(raft.x, raft.y));
      occupied.add(destinationKey);

      return {
        ...raft,
        x: destination.x,
        y: destination.y,
        dockIndex: raft.returnIndex,
        returnIndex: null,
      };
    }

    return raft;
  });

  const nextWorld = nextWorldGrid ? { ...state.world, grid: nextWorldGrid } : state.world;
  return { world: nextWorld, robots: nextRobots, raftStates: nextRaftStates };
};

const spawnNextRobot = (
  state: SimulationState,
  occupied: Set<string>,
): {
  robots: RobotState[];
  spawnedCount: number;
  nextSpawnTick: number | null;
} => {
  const { spawner, spawnedCount, nextSpawnTick } = state;
  if (spawner.count <= spawnedCount) {
    return { robots: state.robots, spawnedCount, nextSpawnTick };
  }

  if (spawner.intervalTicks <= 0) {
    return { robots: state.robots, spawnedCount, nextSpawnTick };
  }

  if (nextSpawnTick === null || state.stepCount < nextSpawnTick) {
    return { robots: state.robots, spawnedCount, nextSpawnTick };
  }

  if (occupied.has(positionKey(spawner.x, spawner.y))) {
    return { robots: state.robots, spawnedCount, nextSpawnTick };
  }

  const nextRobot = createSpawnedRobot(spawner, spawnedCount);
  return {
    robots: [...state.robots, nextRobot],
    spawnedCount: spawnedCount + 1,
    nextSpawnTick: nextSpawnTick + spawner.intervalTicks,
  };
};

export const stepSimulation = (
  state: SimulationState,
  actions: Array<RobotAction | undefined>,
): SimulationState => {
  if (state.status !== 'running') {
    return state;
  }

  let globalSignal = state.globalSignal;
  const occupied = buildOccupiedPositions(state.robots);
  const spawned = spawnNextRobot(state, occupied);
  const nextOccupied = buildOccupiedPositions(spawned.robots);
  const platePressed = isPressurePlatePressed(state.world, spawned.robots);
  const doorOpen = isDoorOpen(state.world, spawned.robots, state.doorUnlocked);
  const isBlocked = (x: number, y: number) =>
    isWall(state.world, x, y) || (isDoor(state.world, x, y) && !doorOpen);
  let nextRobots = spawned.robots.map((robot, index) => {
    const action = actions[index];
    if (!action) {
      return applyExitStatus(state.world, state.exits, robot);
    }

    let nextRobot = robot;
    if (action === 'SIGNAL_ON') {
      globalSignal = true;
    } else if (action === 'SIGNAL_OFF') {
      globalSignal = false;
    }
    const wasBlocking = isBlockingRobot(robot);
    if (wasBlocking) {
      nextOccupied.delete(positionKey(robot.x, robot.y));
    }

    if (action === 'MOVE_FORWARD' && robot.alive && !robot.reachedGoal) {
      const forward = getForwardPosition(robot, robot.direction);
      if (!nextOccupied.has(positionKey(forward.x, forward.y)) && !isBlocked(forward.x, forward.y)) {
        nextRobot = applyAction(state.world, robot, action, { isBlocked });
      }
    } else {
      nextRobot = applyAction(state.world, robot, action, { isBlocked });
    }

    nextRobot = applyExitStatus(state.world, state.exits, nextRobot);

    if (isBlockingRobot(nextRobot)) {
      nextOccupied.add(positionKey(nextRobot.x, nextRobot.y));
    }

    return nextRobot;
  });
  const raftMoveResult = moveRafts(state, nextRobots);
  const raftAdjustedRobots = raftMoveResult.robots.map((robot) =>
    applyExitStatus(raftMoveResult.world, state.exits, robot),
  );
  const doorUnlocked =
    state.doorUnlocked ||
    platePressed ||
    isPressurePlatePressed(raftMoveResult.world, raftAdjustedRobots);
  const stepCount = state.stepCount + 1;
  const savedCount = raftAdjustedRobots.filter((robot) => robot.reachedGoal).length;
  const hasActiveRobot = raftAdjustedRobots.some(
    (robot) => robot.alive && !robot.reachedGoal,
  );
  const hasRemainingSpawns = spawned.spawnedCount < state.spawner.count;

  if (savedCount >= state.requiredSaved) {
    return {
      ...state,
      robots: raftAdjustedRobots,
      spawnedCount: spawned.spawnedCount,
      nextSpawnTick: spawned.nextSpawnTick,
      status: 'won',
      stepCount,
      doorUnlocked,
      globalSignal,
      world: raftMoveResult.world,
      raftStates: raftMoveResult.raftStates,
    };
  }

  if (stepCount >= state.maxSteps) {
    return {
      ...state,
      robots: raftAdjustedRobots,
      spawnedCount: spawned.spawnedCount,
      nextSpawnTick: spawned.nextSpawnTick,
      status: 'lost',
      stepCount,
      doorUnlocked,
      globalSignal,
      world: raftMoveResult.world,
      raftStates: raftMoveResult.raftStates,
    };
  }

  if (!hasActiveRobot && !hasRemainingSpawns) {
    return {
      ...state,
      robots: raftAdjustedRobots,
      spawnedCount: spawned.spawnedCount,
      nextSpawnTick: spawned.nextSpawnTick,
      status: 'lost',
      stepCount,
      doorUnlocked,
      globalSignal,
      world: raftMoveResult.world,
      raftStates: raftMoveResult.raftStates,
    };
  }

  return {
    ...state,
    robots: raftAdjustedRobots,
    spawnedCount: spawned.spawnedCount,
    nextSpawnTick: spawned.nextSpawnTick,
    stepCount,
    doorUnlocked,
    globalSignal,
    world: raftMoveResult.world,
    raftStates: raftMoveResult.raftStates,
  };
};
