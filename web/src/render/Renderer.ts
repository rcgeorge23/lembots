import type { SimulationState } from '../engine/sim';
import type { World } from '../engine/world';

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileAtlas {
  tileSize: number;
  tiles: Record<string, SpriteFrame>;
}

export interface RenderAssets {
  tilesAtlas: TileAtlas;
  tilesImage: HTMLImageElement;
}

export interface Renderer {
  init(canvas: HTMLCanvasElement, assets: RenderAssets): void;
  render(world: World, simulation: SimulationState, dt: number): void;
}
