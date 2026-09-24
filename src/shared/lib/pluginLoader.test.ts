import { describe, it, expect, beforeEach } from 'vitest';
import { PluginManager } from './pluginLoader';
import type { AgentLensPlugin, PluginHookContext } from '../api/plugin';

function makeHookContext(overrides?: Partial<PluginHookContext>): PluginHookContext {
  return {
    targetMode: 'preview',
    artifactsDir: '/tmp/test-artifacts',
    state: new Map<string, unknown>(),
    ...overrides
  };
}

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  describe('register()', () => {
    it('registers a plugin by name', () => {
      const plugin: AgentLensPlugin = { name: 'test-plugin' };
      manager.register(plugin);
      expect(manager.loadedPlugins).toHaveLength(1);
      expect(manager.loadedPlugins[0]?.name).toBe('test-plugin');
    });

    it('does not register duplicate plugins by name', () => {
      const plugin: AgentLensPlugin = { name: 'dupe-plugin' };
      manager.register(plugin);
      manager.register(plugin);
      expect(manager.loadedPlugins).toHaveLength(1);
    });

    it('registers plugins with different names independently', () => {
      manager.register({ name: 'plugin-a' });
      manager.register({ name: 'plugin-b' });
      expect(manager.loadedPlugins).toHaveLength(2);
    });
  });

  describe('runSetup()', () => {
    it('calls setup() on registered plugins', async () => {
      let called = false;
      const plugin: AgentLensPlugin = {
        name: 'setup-plugin',
        setup: async () => { called = true; }
      };
      manager.register(plugin);
      await manager.runSetup(makeHookContext());
      expect(called).toBe(true);
    });

    it('records error if setup() throws instead of crashing', async () => {
      const plugin: AgentLensPlugin = {
        name: 'broken-setup',
        setup: async () => { throw new Error('Setup failed!'); }
      };
      manager.register(plugin);
      // Should not throw
      await expect(manager.runSetup(makeHookContext())).resolves.toBeUndefined();
      const errors = manager.getPluginErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.pluginName).toBe('broken-setup');
      expect(errors[0]?.hook).toBe('setup');
      expect(errors[0]?.message).toBe('Setup failed!');
    });
  });

  describe('runTeardown()', () => {
    it('calls teardown() on registered plugins', async () => {
      let called = false;
      const plugin: AgentLensPlugin = {
        name: 'teardown-plugin',
        teardown: async () => { called = true; }
      };
      manager.register(plugin);
      await manager.runTeardown(makeHookContext());
      expect(called).toBe(true);
    });

    it('continues running teardown for all plugins even if one throws', async () => {
      let secondCalled = false;
      manager.register({
        name: 'broken-teardown',
        teardown: async () => { throw new Error('Teardown failed!'); }
      });
      manager.register({
        name: 'good-teardown',
        teardown: async () => { secondCalled = true; }
      });

      await manager.runTeardown(makeHookContext());
      expect(secondCalled).toBe(true);
    });
  });

  describe('getPluginErrors() / clearErrors()', () => {
    it('starts with no errors', () => {
      expect(manager.getPluginErrors()).toHaveLength(0);
    });

    it('accumulates errors from multiple hooks', async () => {
      const ctx = makeHookContext();
      manager.register({
        name: 'multi-error-plugin',
        setup: async () => { throw new Error('Error in setup'); },
        teardown: async () => { throw new Error('Error in teardown'); }
      });

      await manager.runSetup(ctx);
      await manager.runTeardown(ctx);

      const errors = manager.getPluginErrors();
      expect(errors).toHaveLength(2);
      expect(errors.map(e => e.hook)).toEqual(['setup', 'teardown']);
    });

    it('clearErrors() resets the error list', async () => {
      manager.register({
        name: 'err-plugin',
        setup: async () => { throw new Error('oops'); }
      });
      await manager.runSetup(makeHookContext());
      expect(manager.getPluginErrors()).toHaveLength(1);
      manager.clearErrors();
      expect(manager.getPluginErrors()).toHaveLength(0);
    });
  });

  describe('extendContext()', () => {
    it('merges plugin extensions into ctx', async () => {
      const plugin: AgentLensPlugin = {
        name: 'extender',
        extendContext: () => ({ myCustomMethod: () => 42 })
      };
      manager.register(plugin);

      const ctx = { page: null, context: null } as any;
      await manager.extendContext(ctx, null as any, makeHookContext());

      expect(typeof ctx.myCustomMethod).toBe('function');
      expect(ctx.myCustomMethod()).toBe(42);
    });

    it('records error if extendContext() throws', async () => {
      manager.register({
        name: 'bad-extender',
        extendContext: () => { throw new Error('Extend failed!'); }
      });
      const ctx = {} as any;
      await expect(manager.extendContext(ctx, null as any, makeHookContext())).resolves.toBeUndefined();
      expect(manager.getPluginErrors()[0]?.hook).toBe('extendContext');
    });
  });
});
