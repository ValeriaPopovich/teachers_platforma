import { describe, expect, it } from 'vitest';
import { createAuthFlow, hasRecoveryIntent, RECOVERY_INTENT_KEY } from '../src/auth/auth-flow.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('auth recovery flow', () => {
  it('recognizes recovery callbacks in hash and query URLs', () => {
    expect(hasRecoveryIntent('https://example.test/#access_token=x&type=recovery')).toBe(true);
    expect(hasRecoveryIntent('https://example.test/?type=recovery')).toBe(true);
    expect(hasRecoveryIntent('https://example.test/#type=invite')).toBe(false);
  });

  it('does not lose recovery intent when INITIAL_SESSION arrives first', () => {
    const storage = memoryStorage();
    const flow = createAuthFlow({
      storage,
      url: 'https://example.test/#access_token=x&type=recovery',
    });

    flow.handleEvent('INITIAL_SESSION');

    expect(flow.isRecovery()).toBe(true);
    expect(storage.getItem(RECOVERY_INTENT_KEY)).toBe('1');
  });

  it('persists recovery until it is completed or signed out', () => {
    const storage = memoryStorage();
    const flow = createAuthFlow({ storage, url: 'https://example.test/' });

    flow.handleEvent('PASSWORD_RECOVERY');
    expect(storage.getItem(RECOVERY_INTENT_KEY)).toBe('1');
    expect(createAuthFlow({ storage, url: 'https://example.test/' }).isRecovery()).toBe(true);

    flow.completeRecovery();
    expect(flow.isRecovery()).toBe(false);
    expect(storage.getItem(RECOVERY_INTENT_KEY)).toBe(null);
  });
});
