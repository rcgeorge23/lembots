import { describe, expect, it } from 'vitest';

import { createRobotState } from '../robot';
import { applyAction } from '../rules';
import { createSimulation, stepSimulation } from '../sim';
import { createWorld, TileType } from '../world';

const buildWorld = () =>
  createWorld([
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
    [TileType.Wall, TileType.Empty, TileType.Goal, TileType.Wall],
    [TileType.Wall, TileType.Hazard, TileType.Empty, TileType.Wall],
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
  ]);

const buildOpenWorld = () =>
  createWorld([
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
    [TileType.Wall, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Wall],
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
  ]);

const buildDoorWorld = () =>
  createWorld([
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
    [TileType.Wall, TileType.Empty, TileType.Door, TileType.Empty, TileType.Wall],
    [TileType.Wall, TileType.PressurePlate, TileType.Empty, TileType.Empty, TileType.Wall],
    [TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall, TileType.Wall],
  ]);

describe('simulation rules', () => {
  it('moves forward when the path is clear', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 1);
    const next = applyAction(world, robot, 'MOVE_FORWARD');

    expect(next.x).toBe(2);
    expect(next.y).toBe(1);
  });

  it('does not move into walls', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 0);
    const next = applyAction(world, robot, 'MOVE_FORWARD');

    expect(next.x).toBe(1);
    expect(next.y).toBe(1);
  });

  it('updates direction when turning', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 0);
    const left = applyAction(world, robot, 'TURN_LEFT');
    const right = applyAction(world, robot, 'TURN_RIGHT');

    expect(left.direction).toBe(3);
    expect(right.direction).toBe(1);
  });

  it('marks the robot as lost when it lands on a hazard', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 2);
    const next = applyAction(world, robot, 'MOVE_FORWARD');

    expect(next.alive).toBe(false);
  });

  it('does not lose the robot just for turning on a hazard', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 2, 0);
    const next = applyAction(world, robot, 'TURN_LEFT');

    expect(next.alive).toBe(true);
  });

  it('ends the simulation when reaching the goal', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 1);
    const sim = createSimulation({
      world,
      spawner: {
        x: robot.x,
        y: robot.y,
        dir: robot.direction,
        count: 1,
        intervalTicks: 0,
      },
    });
    const next = stepSimulation(sim, ['MOVE_FORWARD']);

    expect(next.status).toBe('won');
  });

  it('loses when the exit quota is not met after all robots finish', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 1);
    const sim = createSimulation({
      world,
      spawner: {
        x: robot.x,
        y: robot.y,
        dir: robot.direction,
        count: 1,
        intervalTicks: 0,
      },
      requiredSaved: 2,
    });
    const next = stepSimulation(sim, ['MOVE_FORWARD']);

    expect(next.status).toBe('lost');
  });

  it('queues robots so they can follow into cleared spaces', () => {
    const world = buildOpenWorld();
    const sim = createSimulation({
      world,
      spawner: { x: 1, y: 1, dir: 1, count: 0, intervalTicks: 0 },
    });

    const next = stepSimulation(
      {
        ...sim,
        robots: [
          { ...createRobotState(2, 1, 1, 'robot-1') },
          { ...createRobotState(1, 1, 1, 'robot-2') },
        ],
      },
      ['MOVE_FORWARD', 'MOVE_FORWARD'],
    );

    expect(next.robots[0].x).toBe(3);
    expect(next.robots[1].x).toBe(2);
  });

  it('blocks robots from moving into occupied tiles', () => {
    const world = buildOpenWorld();
    const sim = createSimulation({
      world,
      spawner: { x: 1, y: 1, dir: 1, count: 0, intervalTicks: 0 },
    });

    const next = stepSimulation(
      {
        ...sim,
        robots: [
          { ...createRobotState(2, 1, 1, 'robot-1') },
          { ...createRobotState(1, 1, 1, 'robot-2') },
        ],
      },
      ['WAIT', 'MOVE_FORWARD'],
    );

    expect(next.robots[1].x).toBe(1);
  });

  it('delays spawns when the entry tile is occupied', () => {
    const world = buildOpenWorld();
    const sim = createSimulation({
      world,
      spawner: { x: 1, y: 1, dir: 1, count: 2, intervalTicks: 1 },
    });
    const next = stepSimulation({ ...sim, stepCount: 1 }, ['WAIT']);

    expect(next.robots.length).toBe(1);
    expect(next.spawnedCount).toBe(1);
    expect(next.nextSpawnTick).toBe(1);
  });

  it('keeps doors closed when no plates are pressed', () => {
    const world = buildDoorWorld();
    const sim = createSimulation({
      world,
      spawner: { x: 1, y: 1, dir: 1, count: 0, intervalTicks: 0 },
    });
    const next = stepSimulation(
      {
        ...sim,
        robots: [{ ...createRobotState(1, 1, 1, 'robot-1') }],
      },
      ['MOVE_FORWARD'],
    );

    expect(next.robots[0].x).toBe(1);
  });

  it('opens doors after a plate has been pressed', () => {
    const world = buildDoorWorld();
    const sim = createSimulation({
      world,
      spawner: { x: 1, y: 1, dir: 1, count: 0, intervalTicks: 0 },
    });
    const next = stepSimulation(
      {
        ...sim,
        robots: [
          { ...createRobotState(1, 2, 1, 'robot-1') },
          { ...createRobotState(1, 1, 1, 'robot-2') },
        ],
      },
      ['WAIT', 'MOVE_FORWARD'],
    );

    expect(next.robots[1].x).toBe(2);
  });

  it('updates the global signal based on robot actions', () => {
    const world = buildOpenWorld();
    const sim = createSimulation({
      world,
      spawner: { x: 1, y: 1, dir: 1, count: 0, intervalTicks: 0 },
    });
    const withRobot = { ...sim, robots: [{ ...createRobotState(1, 1, 1, 'robot-1') }] };
    const signaledOn = stepSimulation(withRobot, ['SIGNAL_ON']);
    const signaledOff = stepSimulation(signaledOn, ['SIGNAL_OFF']);

    expect(signaledOn.globalSignal).toBe(true);
    expect(signaledOff.globalSignal).toBe(false);
  });
});
