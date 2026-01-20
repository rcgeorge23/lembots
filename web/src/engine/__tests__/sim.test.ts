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

  it('marks the robot as lost on hazards', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 2);
    const next = applyAction(world, robot, 'MOVE_FORWARD');

    expect(next.alive).toBe(false);
  });

  it('ends the simulation when reaching the goal', () => {
    const world = buildWorld();
    const robot = createRobotState(1, 1, 1);
    const sim = createSimulation(world, robot);
    const next = stepSimulation(sim, 'MOVE_FORWARD');

    expect(next.status).toBe('won');
  });
});
