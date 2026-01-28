import { describe, expect, it } from 'vitest';
import { TileType } from '../../engine/world';
import type { SolverLevelDefinition } from '../types';
import { runSolverSearch } from '../search';

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

const baseSpawner = { x: 1, y: 1, dir: 1, count: 1, intervalTicks: 0 };

describe('runSolverSearch()', () => {
  it('finds a solution on a tiny level', () => {
    const grid = makeBorderedGrid(4, 3, (x, y) =>
      x === 2 && y === 1 ? TileType.Goal : TileType.Empty,
    );
    const level: SolverLevelDefinition = {
      grid,
      spawner: baseSpawner,
      exits: [{ x: 2, y: 1 }],
      requiredSaved: 1,
    };

    const result = runSolverSearch(
      level,
      {
        actions: ['MOVE_FORWARD'],
        maxDepth: 2,
        maxAttempts: 10,
        maxTimeMs: 500,
        beamWidth: 5,
      },
      { maxTicks: 5, sampleEvery: 1 },
    );

    expect(result.solved).toBe(true);
    expect(result.state.bestProgram?.steps.length).toBe(1);
    expect(result.state.bestProgram?.steps[0]).toEqual({
      type: 'action',
      action: 'MOVE_FORWARD',
    });
  });

  it('respects the attempt budget when searching', () => {
    const grid = makeBorderedGrid(4, 3, () => TileType.Empty);
    const level: SolverLevelDefinition = {
      grid,
      spawner: baseSpawner,
      exits: [{ x: 3, y: 1 }],
      requiredSaved: 1,
    };

    const result = runSolverSearch(
      level,
      {
        actions: ['MOVE_FORWARD'],
        maxDepth: 2,
        maxAttempts: 1,
        maxTimeMs: 500,
        beamWidth: 2,
      },
      { maxTicks: 5, sampleEvery: 1 },
    );

    expect(result.solved).toBe(false);
    expect(result.state.attempts).toBe(1);
  });
});
