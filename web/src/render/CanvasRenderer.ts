import type { RobotAction } from '../engine/robot';
import type { SimulationState } from '../engine/sim';
import { isDoorOpen } from '../engine/sim';
import { isDoor, isPressurePlate, TileType, type World } from '../engine/world';
import type { RenderAssets, RenderContext, Renderer, SpriteFrame } from './Renderer';

const tileMapping: Record<TileType, string> = {
  [TileType.Empty]: 'floor',
  [TileType.Wall]: 'wall',
  [TileType.Goal]: 'goal',
  [TileType.Hazard]: 'hazard',
  [TileType.PressurePlate]: 'floor',
  [TileType.Door]: 'floor',
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
  SIGNAL_ON: 'SIGNAL ON',
  SIGNAL_OFF: 'SIGNAL OFF',
};

interface RobotAnimState {
  anim: RobotAnim;
  frameIndex: number;
  frameTime: number;
  lastX: number | null;
  lastY: number | null;
  lastDirection: number | null;
}

export class CanvasRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private assets: RenderAssets | null = null;
  private tileSize: number;
  private robotStates = new Map<string, RobotAnimState>();

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

    const pressedPlates = new Set(
      simulation.robots
        .filter((robot) => robot.alive && !robot.reachedGoal)
        .filter((robot) => isPressurePlate(world, robot.x, robot.y))
        .map((robot) => `${robot.x},${robot.y}`),
    );
    const doorOpen = isDoorOpen(world, simulation.robots, simulation.doorUnlocked);
    for (let row = 0; row < world.height; row += 1) {
      for (let col = 0; col < world.width; col += 1) {
        if (isPressurePlate(world, col, row)) {
          this.drawPressurePlate(col, row, pressedPlates.has(`${col},${row}`));
        } else if (isDoor(world, col, row)) {
          this.drawDoor(col, row, doorOpen);
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

    const selectedRobotId = context?.selectedRobotId ?? simulation.robots[0]?.id ?? null;
    const activeIds = new Set(simulation.robots.map((robot) => robot.id));
    for (const id of this.robotStates.keys()) {
      if (!activeIds.has(id)) {
        this.robotStates.delete(id);
      }
    }

    simulation.robots.forEach((robot, index) => {
      const centerX = (robot.x + 0.5) * this.tileSize;
      const centerY = (robot.y + 0.5) * this.tileSize;
      const animState = this.getRobotAnimState(robot.id);
      this.drawRobot(
        ctx,
        assets,
        centerX,
        centerY,
        robot.direction,
        simulation,
        robot,
        animState,
        context,
        dt,
      );

      const isSelected = robot.id === selectedRobotId || (!selectedRobotId && index === 0);
      if (isSelected) {
        this.drawRobotHighlight(ctx, centerX, centerY, robot.alive, robot.reachedGoal);
        if (context?.lastAction) {
          this.drawRobotIndicator(
            ctx,
            centerX,
            centerY,
            actionIndicatorLabels[context.lastAction],
          );
        }
      }

      animState.lastX = robot.x;
      animState.lastY = robot.y;
      animState.lastDirection = robot.direction;
    });
  }

  private getRobotAnimState(robotId: string): RobotAnimState {
    const existing = this.robotStates.get(robotId);
    if (existing) {
      return existing;
    }
    const created: RobotAnimState = {
      anim: 'idle',
      frameIndex: 0,
      frameTime: 0,
      lastX: null,
      lastY: null,
      lastDirection: null,
    };
    this.robotStates.set(robotId, created);
    return created;
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

  private drawPressurePlate(col: number, row: number, pressed: boolean) {
    if (!this.ctx) {
      return;
    }
    const padding = this.tileSize * 0.18;
    const size = this.tileSize - padding * 2;
    this.ctx.save();
    this.ctx.fillStyle = pressed ? '#fbbf24' : '#f59e0b';
    this.ctx.strokeStyle = '#92400e';
    this.ctx.lineWidth = Math.max(1, this.tileSize * 0.08);
    this.ctx.fillRect(
      col * this.tileSize + padding,
      row * this.tileSize + padding,
      size,
      size,
    );
    this.ctx.strokeRect(
      col * this.tileSize + padding,
      row * this.tileSize + padding,
      size,
      size,
    );
    this.ctx.restore();
  }

  private drawDoor(col: number, row: number, open: boolean) {
    if (!this.ctx) {
      return;
    }
    const padding = this.tileSize * 0.12;
    this.ctx.save();
    this.ctx.fillStyle = open ? '#60a5fa' : '#1e293b';
    this.ctx.strokeStyle = open ? '#1d4ed8' : '#0f172a';
    this.ctx.lineWidth = Math.max(1, this.tileSize * 0.08);
    this.ctx.fillRect(
      col * this.tileSize + padding,
      row * this.tileSize + padding,
      this.tileSize - padding * 2,
      this.tileSize - padding * 2,
    );
    this.ctx.strokeRect(
      col * this.tileSize + padding,
      row * this.tileSize + padding,
      this.tileSize - padding * 2,
      this.tileSize - padding * 2,
    );
    if (open) {
      this.ctx.strokeStyle = '#e0f2fe';
      this.ctx.lineWidth = Math.max(1, this.tileSize * 0.06);
      this.ctx.beginPath();
      this.ctx.moveTo(col * this.tileSize + padding, row * this.tileSize + padding);
      this.ctx.lineTo(
        col * this.tileSize + this.tileSize - padding,
        row * this.tileSize + this.tileSize - padding,
      );
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawRobot(
    ctx: CanvasRenderingContext2D,
    assets: RenderAssets,
    centerX: number,
    centerY: number,
    direction: number,
    simulation: SimulationState,
    robot: SimulationState['robots'][number],
    animState: RobotAnimState,
    context: RenderContext | undefined,
    dt: number,
  ) {
    const nextAnim = this.resolveRobotAnimation(simulation, robot, context, animState);
    if (nextAnim !== animState.anim) {
      animState.anim = nextAnim;
      animState.frameIndex = 0;
      animState.frameTime = 0;
    }

    const frames = assets.robotAtlas.animations[animState.anim];
    const safeFrames = frames && frames.length > 0 ? frames : assets.robotAtlas.animations.idle;
    if (!safeFrames || safeFrames.length === 0) {
      return;
    }

    const duration = animationDurations[animState.anim] ?? 500;
    animState.frameTime += dt;
    if (safeFrames.length > 1 && animState.frameTime >= duration) {
      const steps = Math.floor(animState.frameTime / duration);
      animState.frameTime -= steps * duration;
      animState.frameIndex = (animState.frameIndex + steps) % safeFrames.length;
    }

    const frame = safeFrames[animState.frameIndex % safeFrames.length];
    const scale = this.tileSize / assets.robotAtlas.frameSize;

    ctx.save();
    ctx.translate(centerX, centerY);
    const rotation = (Math.PI / 2) * direction;
    ctx.rotate(rotation);
    if (!robot.alive) {
      ctx.globalAlpha = 0.45;
    } else if (robot.reachedGoal) {
      ctx.globalAlpha = 0.7;
    }
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
    animState: RobotAnimState,
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
        animState.lastX === robot.x &&
        animState.lastY === robot.y
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

  private drawRobotHighlight(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    isAlive: boolean,
    reachedGoal: boolean,
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.tileSize * 0.48, 0, Math.PI * 2);
    ctx.strokeStyle = reachedGoal
      ? 'rgba(34, 197, 94, 0.9)'
      : isAlive
        ? 'rgba(56, 189, 248, 0.85)'
        : 'rgba(248, 113, 113, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
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
