export enum TileType {
  Empty = 0,
  Wall = 1,
  Goal = 2,
  Hazard = 3,
}

export interface World {
  grid: TileType[][];
  width: number;
  height: number;
}

export const createWorld = (grid: number[][]): World => {
  const typedGrid = grid.map((row) => row.map((cell) => cell as TileType));
  return {
    grid: typedGrid,
    width: typedGrid[0]?.length ?? 0,
    height: typedGrid.length,
  };
};

export const isInsideWorld = (world: World, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < world.width && y < world.height;

export const getTile = (world: World, x: number, y: number): TileType => {
  if (!isInsideWorld(world, x, y)) {
    return TileType.Wall;
  }

  return world.grid[y][x] ?? TileType.Empty;
};

export const isWall = (world: World, x: number, y: number): boolean =>
  getTile(world, x, y) === TileType.Wall;

export const isGoal = (world: World, x: number, y: number): boolean =>
  getTile(world, x, y) === TileType.Goal;

export const isHazard = (world: World, x: number, y: number): boolean =>
  getTile(world, x, y) === TileType.Hazard;
