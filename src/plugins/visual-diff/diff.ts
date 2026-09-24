import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface VisualDiffOptions {
  threshold?: number; // 0 to 1 (default 0.1)
  includeAA?: boolean; // include anti-aliasing pixels
  diffColor?: [number, number, number]; // RGB
}

export interface VisualDiffResult {
  diffPixels: number;
  totalPixels: number;
  diffPercent: number;
  diffImagePath: string;
  isMatch: boolean;
}

/**
 * Compare two PNG images pixel-by-pixel using pixelmatch and generate a highlighted diff image.
 */
export async function comparePngImages(
  img1Path: string,
  img2Path: string,
  outDiffPath: string,
  options?: VisualDiffOptions
): Promise<VisualDiffResult> {
  if (!fs.existsSync(img1Path)) {
    throw new Error(`[visual-diff] Baseline image not found: ${img1Path}`);
  }
  if (!fs.existsSync(img2Path)) {
    throw new Error(`[visual-diff] Target image not found: ${img2Path}`);
  }

  const img1Data = fs.readFileSync(img1Path);
  const img2Data = fs.readFileSync(img2Path);

  const img1 = PNG.sync.read(img1Data);
  const img2 = PNG.sync.read(img2Data);

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // Resize / pad images to match dimensions if they differ
  const padded1 = padImage(img1, width, height);
  const padded2 = padImage(img2, width, height);

  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    padded1.data,
    padded2.data,
    diff.data,
    width,
    height,
    {
      threshold: options?.threshold ?? 0.1,
      includeAA: options?.includeAA ?? false,
      diffColor: options?.diffColor ?? [255, 0, 80]
    }
  );

  const totalPixels = width * height;
  const diffPercent = totalPixels > 0 ? (diffPixels / totalPixels) * 100 : 0;

  fs.writeFileSync(outDiffPath, PNG.sync.write(diff));

  return {
    diffPixels,
    totalPixels,
    diffPercent: Number(diffPercent.toFixed(2)),
    diffImagePath: outDiffPath,
    isMatch: diffPixels === 0
  };
}

function padImage(src: PNG, width: number, height: number): PNG {
  if (src.width === width && src.height === height) {
    return src;
  }

  const padded = new PNG({ width, height });
  // Fill with white background
  padded.data.fill(255);

  PNG.bitblt(src, padded, 0, 0, src.width, src.height, 0, 0);
  return padded;
}
