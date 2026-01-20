import type { RenderAssets, SpriteFrame, TileAtlas } from './Renderer';

const loadAtlas = async (src: string): Promise<TileAtlas> => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load atlas at ${src}`);
  }
  return (await response.json()) as TileAtlas;
};

const createTilesImage = async (atlas: TileAtlas): Promise<HTMLImageElement> => {
  const canvas = document.createElement('canvas');
  const { width, height } = getAtlasDimensions(atlas);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D context for tiles.');
  }

  drawFloorTile(ctx, atlas.tiles.floor);
  drawWallTile(ctx, atlas.tiles.wall);
  drawGoalTile(ctx, atlas.tiles.goal);
  drawHazardTile(ctx, atlas.tiles.hazard);

  const image = new Image();
  image.src = canvas.toDataURL();
  await image.decode();
  return image;
};

const getAtlasDimensions = (atlas: TileAtlas) => {
  const frames = Object.values(atlas.tiles);
  const width = Math.max(...frames.map((frame) => frame.x + frame.w));
  const height = Math.max(...frames.map((frame) => frame.y + frame.h));
  return { width, height };
};

const fillTile = (
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
};

const drawFloorTile = (ctx: CanvasRenderingContext2D, frame: SpriteFrame) => {
  fillTile(ctx, frame, '#d8d2b6');
  ctx.fillStyle = '#c6bfa2';
  for (let y = 0; y < frame.h; y += 1) {
    for (let x = 0; x < frame.w; x += 1) {
      if ((x + y) % 7 === 0) {
        ctx.fillRect(frame.x + x, frame.y + y, 1, 1);
      }
    }
  }
  drawTileBorder(ctx, frame);
};

const drawWallTile = (ctx: CanvasRenderingContext2D, frame: SpriteFrame) => {
  fillTile(ctx, frame, '#464e59');
  ctx.strokeStyle = '#262d37';
  ctx.lineWidth = 1;
  const brickHeight = Math.floor(frame.h / 4);
  for (let y = 0; y <= frame.h; y += brickHeight) {
    ctx.beginPath();
    ctx.moveTo(frame.x, frame.y + y);
    ctx.lineTo(frame.x + frame.w, frame.y + y);
    ctx.stroke();
  }
  for (let x = 0; x <= frame.w; x += Math.floor(frame.w / 2)) {
    ctx.beginPath();
    ctx.moveTo(frame.x + x, frame.y);
    ctx.lineTo(frame.x + x, frame.y + brickHeight);
    ctx.stroke();
  }
  drawTileBorder(ctx, frame);
};

const drawGoalTile = (ctx: CanvasRenderingContext2D, frame: SpriteFrame) => {
  fillTile(ctx, frame, '#26783c');
  ctx.fillStyle = '#f8cc46';
  const centerX = frame.x + frame.w / 2;
  const centerY = frame.y + frame.h / 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, frame.w * 0.25, 0, Math.PI * 2);
  ctx.fill();
  drawTileBorder(ctx, frame);
};

const drawHazardTile = (ctx: CanvasRenderingContext2D, frame: SpriteFrame) => {
  fillTile(ctx, frame, '#7e2626');
  ctx.fillStyle = '#f0e6dc';
  ctx.beginPath();
  ctx.moveTo(frame.x + frame.w / 2, frame.y + frame.h * 0.2);
  ctx.lineTo(frame.x + frame.w * 0.8, frame.y + frame.h * 0.85);
  ctx.lineTo(frame.x + frame.w * 0.2, frame.y + frame.h * 0.85);
  ctx.closePath();
  ctx.fill();
  drawTileBorder(ctx, frame);
};

const drawTileBorder = (ctx: CanvasRenderingContext2D, frame: SpriteFrame) => {
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.w - 1, frame.h - 1);
};

export const loadRenderAssets = async (): Promise<RenderAssets> => {
  const tilesAtlas = await loadAtlas('/assets/tiles/atlas.json');
  const tilesImage = await createTilesImage(tilesAtlas);

  return { tilesImage, tilesAtlas };
};
