import { describe, it, expect, beforeEach } from 'vitest';
import { MockIpcRegistry, generateMockIpcScript } from './registry';

describe('MockIpcRegistry', () => {
  let registry: MockIpcRegistry;

  beforeEach(() => {
    registry = new MockIpcRegistry();
  });

  describe('set() / get()', () => {
    it('stores and retrieves a mock entry', () => {
      registry.set('GetUserData', { id: 1, name: 'Alice' });
      const entry = registry.get('GetUserData');
      expect(entry).not.toBeNull();
      expect(entry?.data).toEqual({ id: 1, name: 'Alice' });
      expect(entry?.type).toBe('SUCCESS');
      expect(entry?.delayMs).toBe(20);
    });

    it('returns null for unknown actions', () => {
      expect(registry.get('UnknownAction')).toBeNull();
    });

    it('allows overriding an existing entry', () => {
      registry.set('GetConfig', { theme: 'dark' });
      registry.set('GetConfig', { theme: 'light' });
      expect(registry.get('GetConfig')?.data).toEqual({ theme: 'light' });
    });

    it('stores ERROR type correctly', () => {
      registry.set('FailingAction', 'Connection refused', { type: 'ERROR' });
      const entry = registry.get('FailingAction');
      expect(entry?.type).toBe('ERROR');
      expect(entry?.data).toBe('Connection refused');
    });

    it('stores custom delayMs', () => {
      registry.set('SlowAction', {}, { delayMs: 500 });
      expect(registry.get('SlowAction')?.delayMs).toBe(500);
    });
  });

  describe('setBatch()', () => {
    it('registers multiple mocks at once', () => {
      registry.setBatch([
        { action: 'GetUser', data: { id: 1 } },
        { action: 'GetPosts', data: [] },
        { action: 'DeleteItem', data: null, type: 'ERROR' }
      ]);

      expect(registry.get('GetUser')?.data).toEqual({ id: 1 });
      expect(registry.get('GetPosts')?.data).toEqual([]);
      expect(registry.get('DeleteItem')?.type).toBe('ERROR');
      expect(registry.size).toBe(3);
    });
  });

  describe('remove() / clear()', () => {
    it('removes a specific entry', () => {
      registry.set('ToRemove', {});
      registry.remove('ToRemove');
      expect(registry.get('ToRemove')).toBeNull();
    });

    it('clear() removes all entries', () => {
      registry.set('A', 1);
      registry.set('B', 2);
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe('toSerializable()', () => {
    it('returns a plain object suitable for JSON injection', () => {
      registry.set('GetFoo', { foo: true }, { type: 'SUCCESS', delayMs: 100 });
      const serialized = registry.toSerializable();
      expect(serialized['GetFoo']).toEqual({ data: { foo: true }, type: 'SUCCESS', delayMs: 100 });
    });
  });

  describe('size', () => {
    it('reflects the correct count', () => {
      expect(registry.size).toBe(0);
      registry.set('A', 1);
      expect(registry.size).toBe(1);
      registry.set('B', 2);
      expect(registry.size).toBe(2);
      registry.remove('A');
      expect(registry.size).toBe(1);
    });
  });
});

describe('generateMockIpcScript()', () => {
  it('generates a valid self-executing script string', () => {
    const registry = new MockIpcRegistry();
    registry.set('GetVersion', '1.2.3');
    const script = generateMockIpcScript(registry);

    expect(typeof script).toBe('string');
    expect(script).toContain('window.__mockIpc');
    expect(script).toContain('window.__visualRunnerMocks');
    expect(script).toContain('"GetVersion"');
    expect(script).toContain('"1.2.3"');
  });

  it('generates an empty but valid script for an empty registry', () => {
    const registry = new MockIpcRegistry();
    const script = generateMockIpcScript(registry);
    expect(script).toContain('window.__mockIpc');
    expect(script).not.toThrow;
  });
});
