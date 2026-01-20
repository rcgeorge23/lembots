import type { RenderAssets, TileAtlas } from './Renderer';

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

export const loadRenderAssets = async (): Promise<RenderAssets> => {
  const tilesAtlas = await loadAtlas('/assets/tiles/atlas.json');
  const tilesImage = await loadTilesImage('/assets/tiles/tiles.png');

  return { tilesImage, tilesAtlas };
};
