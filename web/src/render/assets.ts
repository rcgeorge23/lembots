import type { RenderAssets, RobotAtlas, TileAtlas } from './Renderer';

const loadAtlas = async (src: string): Promise<TileAtlas> => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load atlas at ${src}`);
  }
  return (await response.json()) as TileAtlas;
};

const loadTilesImage = async (src: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
};

const loadWaterImage = async (src: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
};

const loadRobotAtlas = async (src: string): Promise<RobotAtlas> => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to load atlas at ${src}`);
  }
  return (await response.json()) as RobotAtlas;
};

const loadRobotImage = async (src: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
};

export const loadRenderAssets = async (): Promise<RenderAssets> => {
  const tilesAtlas = await loadAtlas('/assets/tiles/atlas.json');
  const tilesImage = await loadTilesImage('/assets/tiles/tiles.png');
  const waterImage = await loadWaterImage('/assets/tiles/EC240B69-441F-46B4-BF10-1BFB19FB34E9.jpeg');
  const robotAtlas = await loadRobotAtlas('/assets/robot/robot_atlas.json');
  const robotImage = await loadRobotImage('/assets/robot/robot.svg');

  return { tilesImage, tilesAtlas, waterImage, robotAtlas, robotImage };
};
