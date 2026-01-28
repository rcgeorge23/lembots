import { describe, expect, it } from 'vitest';
import { TileType } from '../../engine/world';
import type { SolverLevelDefinition, SolverProgram } from '../types';
import { evaluate } from '../evaluate';

const makeBorderedGrid = (
  width: number,
  height: number,
  interior: (x: number, y: number) => TileType = () => TileType.Empty,
): TileType[][] =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        return TileType.Wall;
      }
      return interior(x, y);
    }),
  );

const makeProgram = (actions: Array<SolverProgram['steps'][number]>) => ({
  type: 'sequence' as const,
  steps: actions,
});

const moveForwardProgram: SolverProgram = makeProgram([
  { type: 'action', action: 'MOVE_FORWARD' },
  { type: 'action', action: 'MOVE_FORWARD' },
]);

const baseSpawner = { x: 1, y: 1, dir: 1, count: 1, intervalTicks: 0 };

describe('evaluate()', () => {
  it('solves a simple straight-line level', () => {
    const grid = makeBorderedGrid(5, 3, (x, y) =>
      x === 3 && y === 1 ? TileType.Goal : TileType.Empty,
    );
    const level: SolverLevelDefinition = {
      grid,
      spawner: baseSpawner,
      exits: [{ x: 3, y: 1 }],
      requiredSaved: 1,
    };

    const result = evaluate(moveForwardProgram, level, { maxTicks: 10, sampleEvery: 1 });

    expect(result.solved).toBe(true);
    expect(result.finalRobots.length).toBe(0);
    expect(result.events.anySaved).toBe(true);
    expect(result.traceLite?.frames.length).toBeGreaterThan(1);
  });

  it('records pressure plate and door events along the route', () => {
    const grid = makeBorderedGrid(5, 3, (x, y) => {
      if (x === 2 && y === 1) {
        return TileType.PressurePlate;
      }
      if (x === 3 && y === 1) {
        return TileType.Goal;
      }
      return TileType.Empty;
    });
    const level: SolverLevelDefinition = {
      grid,
      spawner: baseSpawner,
      exits: [{ x: 3, y: 1 }],
      requiredSaved: 1,
    };

    const result = evaluate(moveForwardProgram, level, { maxTicks: 10, sampleEvery: 1 });

    expect(result.solved).toBe(true);
    expect(result.events.pressurePlatePressed).toBe(true);
    expect(result.events.doorOpened).toBe(true);
    expect(result.events.waterTouched).toBe(false);
  });
});
