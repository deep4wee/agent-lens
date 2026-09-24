import { definePlugin, type AgentLensPlugin } from '../../shared/api/plugin';
import {
  clickCoords,
  dragAndDrop,
  scrollPercent,
  snapLive,
  handleLiveCli,
  type SnapLiveOptions
} from './actions';

export {
  clickCoords,
  dragAndDrop,
  scrollPercent,
  snapLive,
  handleLiveCli,
  type SnapLiveOptions
};

export const liveControllerPlugin: AgentLensPlugin = definePlugin({
  name: 'live-controller',
  version: '1.0.0',

  extendContext: (_ctx, page) => {
    return {
      clickCoords: async (
        x: number,
        y: number,
        options?: { button?: 'left' | 'right' | 'middle'; clickCount?: number }
      ) => {
        await clickCoords(page, x, y, options);
      },

      dragAndDrop: async (
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        steps?: number
      ) => {
        await dragAndDrop(page, fromX, fromY, toX, toY, steps);
      },

      scrollPercent: async (percent: number) => {
        await scrollPercent(page, percent);
      },

      snapLive: async (options?: SnapLiveOptions) => {
        return await snapLive(page, options);
      }
    };
  }
});

export default liveControllerPlugin;
