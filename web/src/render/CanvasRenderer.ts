import type { RobotAction } from '../engine/robot';
import type { SimulationState } from '../engine/sim';
import { TileType, type World } from '../engine/world';
import type { RenderAssets, RenderContext, Renderer, SpriteFrame } from './Renderer';

const tileMapping: Record<TileType, string> = {
  [TileType.Empty]: 'floor',
  [TileType.Wall]: 'wall',
  [TileType.Goal]: 'goal',
  [TileType.Hazard]: 'hazard',
};

type RobotAnim = 'idle' | 'walk' | 'turn' | 'bump' | 'win' | 'fail';
const animationDurations: Record<RobotAnim, number> = {
  idle: 900,
  walk: 240,
  turn: 320,
  bump: 180,
  win: 400,
  fail: 900,
};
const actionIndicatorLabels: Record<RobotAction, string> = {
  MOVE_FORWARD: 'MOVE',
  TURN_LEFT: 'LEFT',
  TURN_RIGHT: 'RIGHT',
  WAIT: 'WAIT',
};

export class CanvasRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private assets: RenderAssets | null = null;
  private tileSize: number;
  private robotAnim: RobotAnim = 'idle';
  private robotFrameIndex = 0;
  private robotFrameTime = 0;
  private lastRobotX: number | null = null;
  private lastRobotY: number | null = null;
  private lastRobotDirection: number | null = null;

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

  render(world: World, simulation: SimulationState, dt: number, context?: RenderContext): void {
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

    const robot = simulation.robots[0];
    if (robot) {
      const centerX = (robot.x + 0.5) * this.tileSize;
      const centerY = (robot.y + 0.5) * this.tileSize;
      this.drawRobot(ctx, assets, centerX, centerY, robot.direction, simulation, robot, context, dt);
      if (context?.lastAction) {
        this.drawRobotIndicator(
          ctx,
          centerX,
          centerY,
          actionIndicatorLabels[context.lastAction],
        );
      }

      this.lastRobotX = robot.x;
      this.lastRobotY = robot.y;
      this.lastRobotDirection = robot.direction;
    } else {
      this.lastRobotX = null;
      this.lastRobotY = null;
      this.lastRobotDirection = null;
    }
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

  private drawRobot(
    ctx: CanvasRenderingContext2D,
    assets: RenderAssets,
    centerX: number,
    centerY: number,
    direction: number,
    simulation: SimulationState,
    robot: SimulationState['robots'][number],
    context: RenderContext | undefined,
    dt: number,
  ) {
    const nextAnim = this.resolveRobotAnimation(simulation, robot, context);
    if (nextAnim !== this.robotAnim) {
      this.robotAnim = nextAnim;
      this.robotFrameIndex = 0;
      this.robotFrameTime = 0;
    }

    const frames = assets.robotAtlas.animations[this.robotAnim];
    const safeFrames = frames && frames.length > 0 ? frames : assets.robotAtlas.animations.idle;
    if (!safeFrames || safeFrames.length === 0) {
      return;
    }

    const duration = animationDurations[this.robotAnim] ?? 500;
    this.robotFrameTime += dt;
    if (safeFrames.length > 1 && this.robotFrameTime >= duration) {
      const steps = Math.floor(this.robotFrameTime / duration);
      this.robotFrameTime -= steps * duration;
      this.robotFrameIndex = (this.robotFrameIndex + steps) % safeFrames.length;
    }

    const frame = safeFrames[this.robotFrameIndex % safeFrames.length];
    const scale = this.tileSize / assets.robotAtlas.frameSize;

    ctx.save();
    ctx.translate(centerX, centerY);
    const rotation = (Math.PI / 2) * direction;
    ctx.rotate(rotation);
    ctx.drawImage(
      assets.robotImage,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -frame.w * scale * 0.5,
      -frame.h * scale * 0.5,
      frame.w * scale,
      frame.h * scale,
    );
    ctx.restore();
  }

  private resolveRobotAnimation(
    simulation: SimulationState,
    robot: SimulationState['robots'][number],
    context: RenderContext | undefined,
  ): RobotAnim {
    if (simulation.status === 'won') {
      return 'win';
    }
    if (simulation.status === 'lost') {
      return 'fail';
    }

    const lastAction = context?.lastAction ?? null;
    if (!lastAction) {
      return 'idle';
    }

    if (lastAction === 'MOVE_FORWARD') {
      if (
        this.lastRobotX === robot.x &&
        this.lastRobotY === robot.y
      ) {
        return 'bump';
      }
      return 'walk';
    }

    if (lastAction === 'TURN_LEFT' || lastAction === 'TURN_RIGHT') {
      return 'turn';
    }

    return 'idle';
  }

  private drawRobotIndicator(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    label: string,
  ) {
    const paddingX = 6;
    const bubbleHeight = 18;
    const bubbleOffset = this.tileSize * 0.7;
    const pointerHeight = 6;

    ctx.save();
    ctx.font = '11px "Share Tech Mono", "SFMono-Regular", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textWidth = ctx.measureText(label).width;
    const bubbleWidth = Math.max(40, textWidth + paddingX * 2);
    const bubbleX = centerX - bubbleWidth / 2;
    let bubbleY = centerY - bubbleOffset - bubbleHeight;
    bubbleY = Math.max(2, bubbleY);
    const radius = 6;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bubbleX + radius, bubbleY);
    ctx.arcTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + bubbleHeight, radius);
    ctx.arcTo(
      bubbleX + bubbleWidth,
      bubbleY + bubbleHeight,
      bubbleX,
      bubbleY + bubbleHeight,
      radius,
    );
    ctx.arcTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY, radius);
    ctx.arcTo(bubbleX, bubbleY, bubbleX + bubbleWidth, bubbleY, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const pointerY = bubbleY + bubbleHeight;
    ctx.beginPath();
    ctx.moveTo(centerX - 5, pointerY);
    ctx.lineTo(centerX + 5, pointerY);
    ctx.lineTo(centerX, pointerY + pointerHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, centerX, bubbleY + bubbleHeight / 2);
    ctx.restore();
  }
}
