import type { Direction, RobotAction, RobotState } from './robot';
import type { World } from './world';
import { applyAction } from './rules';

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
}

export interface SimulationConfig {
  world: World;
  spawner: Spawner;
  exits?: Exit[];
  maxSteps?: number;
  requiredSaved?: number;
}

const createSpawnedRobot = (spawner: Spawner, index: number): RobotState => ({
  id: `robot-${index + 1}`,
  x: spawner.x,
  y: spawner.y,
  direction: spawner.dir,
  alive: true,
  reachedGoal: false,
});

const initializeRobots = (spawner: Spawner): {
  robots: RobotState[];
  spawnedCount: number;
  nextSpawnTick: number | null;
} => {
  if (spawner.count <= 0) {
    return { robots: [], spawnedCount: 0, nextSpawnTick: null };
  }

  if (spawner.intervalTicks <= 0) {
    const robots = Array.from({ length: spawner.count }, (_, index) =>
      createSpawnedRobot(spawner, index),
    );
    return { robots, spawnedCount: spawner.count, nextSpawnTick: null };
  }

  return {
    robots: [createSpawnedRobot(spawner, 0)],
    spawnedCount: 1,
    nextSpawnTick: spawner.intervalTicks,
  };
};

export const createSimulation = ({
  world,
  spawner,
  exits = [],
  maxSteps = 200,
  requiredSaved = 1,
}: SimulationConfig): SimulationState => {
  const { robots, spawnedCount, nextSpawnTick } = initializeRobots(spawner);
  const hasReachedGoal = robots.some((robot) => robot.reachedGoal);
  return {
    world,
    robots,
    spawner,
    exits,
    status: hasReachedGoal ? 'won' : 'running',
    stepCount: 0,
    maxSteps,
    requiredSaved,
    spawnedCount,
    nextSpawnTick,
  };
};

const spawnNextRobot = (
  state: SimulationState,
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

  const nextRobot = createSpawnedRobot(spawner, spawnedCount);
  return {
    robots: [...state.robots, nextRobot],
    spawnedCount: spawnedCount + 1,
    nextSpawnTick: nextSpawnTick + spawner.intervalTicks,
  };
};

export const stepSimulation = (
  state: SimulationState,
  actions: RobotAction[],
): SimulationState => {
  if (state.status !== 'running') {
    return state;
  }

  const spawned = spawnNextRobot(state);
  const nextRobots = spawned.robots.map((robot, index) => {
    const action = actions[index];
    if (!action) {
      return robot;
    }
    return applyAction(state.world, robot, action);
  });
  const stepCount = state.stepCount + 1;
  const hasReachedGoal = nextRobots.some((robot) => robot.reachedGoal);
  const hasAliveRobot = nextRobots.some((robot) => robot.alive);
  const hasRemainingSpawns = spawned.spawnedCount < state.spawner.count;

  if (hasReachedGoal) {
    return {
      ...state,
      robots: nextRobots,
      spawnedCount: spawned.spawnedCount,
      nextSpawnTick: spawned.nextSpawnTick,
      status: 'won',
      stepCount,
    };
  }

  if (stepCount >= state.maxSteps) {
    return {
      ...state,
      robots: nextRobots,
      spawnedCount: spawned.spawnedCount,
      nextSpawnTick: spawned.nextSpawnTick,
      status: 'lost',
      stepCount,
    };
  }

  if (!hasAliveRobot && !hasRemainingSpawns) {
    return {
      ...state,
      robots: nextRobots,
      spawnedCount: spawned.spawnedCount,
      nextSpawnTick: spawned.nextSpawnTick,
      status: 'lost',
      stepCount,
    };
  }

  return {
    ...state,
    robots: nextRobots,
    spawnedCount: spawned.spawnedCount,
    nextSpawnTick: spawned.nextSpawnTick,
    stepCount,
  };
};
