import { createVm, stepVm } from '../blocks/vm';
import { isDoorOpen, stepSimulation, createSimulation } from '../engine/sim';
import type { RobotAction, RobotState, Direction } from '../engine/robot';
import { createWorld, isPressurePlate, isRaft, isWater } from '../engine/world';
import { toProgramNode } from './translate';
import type {
  EvalOptions,
  EvalResult,
  EventSummary,
  SolverLevelDefinition,
  SolverProgram,
  TraceLite,
  TraceLiteFrame,
} from './types';

const DEFAULT_SAMPLE_EVERY = 5;

const parseDirection = (direction: number | 'N' | 'E' | 'S' | 'W'): Direction => {
  if (typeof direction === 'number') {
    return ((direction % 4) + 4) % 4 as Direction;
  }

  switch (direction) {
    case 'N':
      return 0;
    case 'E':
      return 1;
    case 'S':
      return 2;
    case 'W':
      return 3;
    default:
      return 1;
  }
};

const createSimulationForLevel = (
  level: SolverLevelDefinition,
  options: EvalOptions,
) => {
  const world = createWorld(level.grid);
  const fallbackStart = level.start ?? { x: 1, y: 1, dir: 1 };
  const rawSpawner =
    level.spawner ?? {
      x: fallbackStart.x,
      y: fallbackStart.y,
      dir: fallbackStart.dir,
      count: 1,
      intervalTicks: 0,
    };
  const spawner = {
    ...rawSpawner,
    dir: parseDirection(rawSpawner.dir),
    starts: rawSpawner.starts?.map((start) => ({
      ...start,
      dir: parseDirection(start.dir),
    })),
  };
  const exits = level.exits ?? (level.goal ? [level.goal] : []);
  return createSimulation({
    world,
    spawner,
    exits,
    maxSteps: level.maxTicks ?? options.maxTicks ?? 200,
    requiredSaved: level.requiredSaved ?? 1,
  });
};

const snapshotRobots = (robots: RobotState[]): RobotState[] =>
  robots.map((robot) => ({ ...robot }));

const getRobotStatus = (robot: RobotState): TraceLiteFrame['status'] => {
  if (robot.reachedGoal) {
    return 'saved';
  }
  if (!robot.alive) {
    return 'dead';
  }
  return 'alive';
};

const snapshotFrame = (robots: RobotState[]): TraceLiteFrame[] =>
  robots.map((robot) => ({
    id: robot.id,
    x: robot.x,
    y: robot.y,
    dir: robot.direction,
    status: getRobotStatus(robot),
  }));

const updateEvents = (
  events: EventSummary,
  robots: RobotState[],
  levelWorld: ReturnType<typeof createWorld>,
  doorOpen: boolean,
  savedCount: number,
): EventSummary => {
  const pressurePlatePressed = robots.some(
    (robot) => robot.alive && isPressurePlate(levelWorld, robot.x, robot.y),
  );
  const raftUsed = robots.some(
    (robot) => robot.alive && isRaft(levelWorld, robot.x, robot.y),
  );
  const waterTouched = robots.some(
    (robot) => robot.alive && isWater(levelWorld, robot.x, robot.y),
  );
  return {
    doorOpened: events.doorOpened || doorOpen,
    pressurePlatePressed: events.pressurePlatePressed || pressurePlatePressed,
    raftUsed: events.raftUsed || raftUsed,
    waterTouched: events.waterTouched || waterTouched,
    anySaved: events.anySaved || savedCount > 0,
  };
};

const computeScore = (
  robots: RobotState[],
  exits: { x: number; y: number }[],
  savedCount: number,
  events: EventSummary,
  status: 'running' | 'won' | 'lost',
): number => {
  let score = savedCount * 1000;
  if (events.doorOpened) {
    score += 50;
  }
  if (events.pressurePlatePressed) {
    score += 25;
  }
  if (events.raftUsed) {
    score += 50;
  }
  if (events.waterTouched) {
    score += 10;
  }

  if (status === 'won') {
    score += 5000;
  }

  if (exits.length > 0) {
    let minDistance = Infinity;
    robots.forEach((robot) => {
      if (!robot.alive) {
        return;
      }
      exits.forEach((exit) => {
        const distance = Math.abs(exit.x - robot.x) + Math.abs(exit.y - robot.y);
        minDistance = Math.min(minDistance, distance);
      });
    });
    if (minDistance !== Infinity) {
      score += Math.max(0, 100 - minDistance);
    }
  }

  return score;
};

export const evaluate = (
  program: SolverProgram,
  level: SolverLevelDefinition,
  options: EvalOptions = {},
): EvalResult => {
  const compiledProgram = toProgramNode(program);
  let simulation = createSimulationForLevel(level, options);
  const vmStates = new Map<string, ReturnType<typeof createVm>>();
  const sampleEvery = options.sampleEvery ?? DEFAULT_SAMPLE_EVERY;
  const traceLite: TraceLite = {
    sampleEvery,
    frames: [],
  };
  let events: EventSummary = {
    doorOpened: false,
    pressurePlatePressed: false,
    raftUsed: false,
    waterTouched: false,
    anySaved: false,
  };
  let bestScore = -Infinity;
  let bestRobots = snapshotRobots(simulation.robots);
  let tickIndex = 0;

  traceLite.frames.push(snapshotFrame(simulation.robots));

  while (simulation.status === 'running') {
    const actions: Array<RobotAction | undefined> = [];
    let sawStepLimit = false;
    const doorOpen = isDoorOpen(
      simulation.world,
      simulation.robots,
      simulation.doorUnlocked,
    );
    const occupiedPositions = new Set<string>();
    simulation.robots.forEach((robot) => {
      if (robot.alive && !robot.reachedGoal) {
        occupiedPositions.add(`${robot.x},${robot.y}`);
      }
    });

    simulation.robots.forEach((robot) => {
      let robotVm = vmStates.get(robot.id);
      if (!robotVm) {
        robotVm = createVm(compiledProgram, options.maxVmSteps ?? simulation.maxSteps);
        vmStates.set(robot.id, robotVm);
      }

      if (!robot.alive || robot.reachedGoal || robotVm.status !== 'running') {
        actions.push(undefined);
        return;
      }

      const vmResult = stepVm(robotVm, {
        world: simulation.world,
        robot,
        exits: simulation.exits,
        doorOpen,
        occupiedPositions,
      });
      vmStates.set(robot.id, vmResult.state);
      actions.push(vmResult.action);

      if (vmResult.state.status === 'step_limit') {
        sawStepLimit = true;
      }
    });

    const hasRemainingSpawns =
      simulation.spawnedCount < simulation.spawner.count;
    if (
      actions.some((action) => action) ||
      (simulation.robots.length === 0 && hasRemainingSpawns)
    ) {
      simulation = stepSimulation(simulation, actions);
    } else if (!hasRemainingSpawns) {
      simulation = { ...simulation, status: 'lost' };
    }

    if (sawStepLimit && simulation.status === 'running') {
      simulation = { ...simulation, status: 'lost' };
    }

    events = updateEvents(
      events,
      simulation.robots,
      simulation.world,
      isDoorOpen(simulation.world, simulation.robots, simulation.doorUnlocked),
      simulation.savedCount,
    );

    const score = computeScore(
      simulation.robots,
      simulation.exits,
      simulation.savedCount,
      events,
      simulation.status,
    );
    if (score > bestScore) {
      bestScore = score;
      bestRobots = snapshotRobots(simulation.robots);
    }

    tickIndex += 1;
    if (tickIndex % sampleEvery === 0) {
      traceLite.frames.push(snapshotFrame(simulation.robots));
    }
  }

  if (tickIndex % sampleEvery !== 0) {
    traceLite.frames.push(snapshotFrame(simulation.robots));
  }

  return {
    solved: simulation.status === 'won',
    score: bestScore,
    ticks: simulation.stepCount,
    finalRobots: snapshotRobots(simulation.robots),
    bestRobots,
    events,
    traceLite,
  };
};
