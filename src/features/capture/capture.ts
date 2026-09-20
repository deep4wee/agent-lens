import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright';
import type { CaptureOptions, CaptureBurstOptions, SnapshotMetadata } from '../../shared/api/dsl';

export class CaptureEngine {
  private outputDir: string;
  private currentStepIndex: number = 0;
  private recordedSnapshots: SnapshotMetadata[] = [];

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  public getSnapshots(): SnapshotMetadata[] {
    return this.recordedSnapshots;
  }

  public getOutputDir(): string {
    return this.outputDir;
  }

  /**
   */
  public async takeSnapshot(
    page: Page,
    name: string,
    viewport: { width: number; height: number },
    options?: CaptureOptions
  ): Promise<SnapshotMetadata> {
    this.currentStepIndex += 1;
    const paddedIndex = String(this.currentStepIndex).padStart(2, '0');
    const sanitizedName = name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = `${paddedIndex}_${sanitizedName}_${viewport.width}x${viewport.height}.png`;
    const filePath = path.join(this.outputDir, fileName);

    if (options?.selector) {
      const element = await page.waitForSelector(options.selector, { timeout: 5000 });
      await element.screenshot({ path: filePath });
    } else {
      await page.screenshot({ path: filePath, fullPage: options?.fullPage ?? false });
    }

    const metadata: SnapshotMetadata = {
      index: this.currentStepIndex,
      name,
      fileName,
      filePath,
      relativeUri: `./${fileName}`,
      viewport,
      timestamp: new Date().toISOString(),
      selector: options?.selector
    };

    this.recordedSnapshots.push(metadata);
    return metadata;
  }

  /**
   */
  public async takeBurst(
    page: Page,
    name: string,
    viewport: { width: number; height: number },
    options: CaptureBurstOptions
  ): Promise<SnapshotMetadata[]> {
    this.currentStepIndex += 1;
    const stepIndex = this.currentStepIndex;
    const paddedIndex = String(stepIndex).padStart(2, '0');
    const sanitizedName = name.replace(/[^a-zA-Z0-9_\-]/g, '_');

    const duration = Math.max(options.durationMs, 50);
    const interval = Math.max(options.intervalMs ?? 80, 20);
    const totalFrames = Math.ceil(duration / interval);

    const burstSnapshots: SnapshotMetadata[] = [];
    const burstGroup = sanitizedName;

    for (let frame = 0; frame <= totalFrames; frame++) {
      const elapsedMs = frame * interval;
      const paddedFrame = String(frame + 1).padStart(2, '0');
      const fileName = `${paddedIndex}_burst_${sanitizedName}_f${paddedFrame}_${elapsedMs}ms.png`;
      const filePath = path.join(this.outputDir, fileName);

      if (options.selector) {
        const element = await page.$(options.selector);
        if (element) {
          await element.screenshot({ path: filePath });
        } else {
          await page.screenshot({ path: filePath });
        }
      } else {
        await page.screenshot({ path: filePath });
      }

      const meta: SnapshotMetadata = {
        index: stepIndex,
        name: `${name} (frame ${frame + 1}, +${elapsedMs}ms)`,
        fileName,
        filePath,
        relativeUri: `./${fileName}`,
        viewport,
        timestamp: new Date().toISOString(),
        isBurstFrame: true,
        burstGroup,
        frameIndex: frame + 1,
        selector: options.selector
      };

      burstSnapshots.push(meta);
      this.recordedSnapshots.push(meta);

      if (frame < totalFrames) {
        await new Promise((r) => setTimeout(r, interval));
      }
    }

    return burstSnapshots;
  }
}
