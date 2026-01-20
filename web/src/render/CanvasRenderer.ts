import type { SimulationState } from '../engine/sim';
import { TileType, type World } from '../engine/world';
import type { RenderAssets, Renderer, SpriteFrame } from './Renderer';

const tileMapping: Record<TileType, string> = {
  [TileType.Empty]: 'floor',
  [TileType.Wall]: 'wall',
  [TileType.Goal]: 'goal',
  [TileType.Hazard]: 'hazard',
};

const drawRobotSprite = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  direction: number,
  alive: boolean,
  tileSize: number,
) => {
  const bodySize = tileSize * 0.55;
  const radius = 6;
  ctx.fillStyle = alive ? '#0f172a' : '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(centerX - bodySize / 2 + radius, centerY - bodySize / 2);
  ctx.lineTo(centerX + bodySize / 2 - radius, centerY - bodySize / 2);
  ctx.quadraticCurveTo(
    centerX + bodySize / 2,
    centerY - bodySize / 2,
    centerX + bodySize / 2,
    centerY - bodySize / 2 + radius,
  );
  ctx.lineTo(centerX + bodySize / 2, centerY + bodySize / 2 - radius);
  ctx.quadraticCurveTo(
    centerX + bodySize / 2,
    centerY + bodySize / 2,
    centerX + bodySize / 2 - radius,
    centerY + bodySize / 2,
  );
  ctx.lineTo(centerX - bodySize / 2 + radius, centerY + bodySize / 2);
  ctx.quadraticCurveTo(
    centerX - bodySize / 2,
    centerY + bodySize / 2,
    centerX - bodySize / 2,
    centerY + bodySize / 2 - radius,
  );
  ctx.lineTo(centerX - bodySize / 2, centerY - bodySize / 2 + radius);
  ctx.quadraticCurveTo(
    centerX - bodySize / 2,
    centerY - bodySize / 2,
    centerX - bodySize / 2 + radius,
    centerY - bodySize / 2,
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(centerX - bodySize * 0.12, centerY - bodySize * 0.1, 3, 0, Math.PI * 2);
  ctx.arc(centerX + bodySize * 0.12, centerY - bodySize * 0.1, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  const directionOffset = tileSize * 0.3;
  const directionVectors = [
    { x: 0, y: -directionOffset },
    { x: directionOffset, y: 0 },
    { x: 0, y: directionOffset },
    { x: -directionOffset, y: 0 },
  ];
  const vector = directionVectors[direction];
  ctx.lineTo(centerX + vector.x, centerY + vector.y);
  ctx.stroke();
  ctx.lineWidth = 1;
};

export class CanvasRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private assets: RenderAssets | null = null;
  private tileSize: number;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
  }

  init(canvas: HTMLCanvasElement, assets: RenderAssets): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.assets = assets;
    ctx.imageSmoothingEnabled = false;
  }

  render(world: World, simulation: SimulationState, _dt: number): void {
    if (!this.ctx || !this.canvas || !this.assets) {
      return;
    }

    const { ctx, canvas, assets } = this;
    const width = world.width * this.tileSize;
    const height = world.height * this.tileSize;

    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { tilesAtlas, tilesImage } = assets;
    const scale = this.tileSize / tilesAtlas.tileSize;

    for (let row = 0; row < world.height; row += 1) {
      for (let col = 0; col < world.width; col += 1) {
        const tile = world.grid[row][col];
        const tileKey = tileMapping[tile] ?? 'floor';
        const sprite = tilesAtlas.tiles[tileKey];
        if (sprite) {
          this.drawTile(tilesImage, sprite, col, row, scale);
        }
      }
    }

    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    for (let row = 0; row < world.height; row += 1) {
      for (let col = 0; col < world.width; col += 1) {
        ctx.strokeRect(col * this.tileSize, row * this.tileSize, this.tileSize, this.tileSize);
      }
    }

    const { robot } = simulation;
    const centerX = (robot.x + 0.5) * this.tileSize;
    const centerY = (robot.y + 0.5) * this.tileSize;
    drawRobotSprite(ctx, centerX, centerY, robot.direction, robot.alive, this.tileSize);
  }

  private drawTile(
    image: HTMLImageElement,
    sprite: SpriteFrame,
    col: number,
    row: number,
    scale: number,
  ) {
    if (!this.ctx) {
      return;
    }
    this.ctx.drawImage(
      image,
      sprite.x,
      sprite.y,
      sprite.w,
      sprite.h,
      col * this.tileSize,
      row * this.tileSize,
      sprite.w * scale,
      sprite.h * scale,
    );
  }
}
