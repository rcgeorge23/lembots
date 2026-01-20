import type { RobotAction } from '../engine/robot';
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

export interface RobotAtlas {
  frameSize: number;
  animations: Record<string, SpriteFrame[]>;
}

export interface RenderAssets {
  tilesAtlas: TileAtlas;
  tilesImage: HTMLImageElement;
  robotAtlas: RobotAtlas;
  robotImage: HTMLImageElement;
}

export interface RenderContext {
  lastAction?: RobotAction | null;
  selectedRobotId?: string | null;
}

export interface Renderer {
  init(canvas: HTMLCanvasElement, assets: RenderAssets): void;
  render(world: World, simulation: SimulationState, dt: number, context?: RenderContext): void;
}
