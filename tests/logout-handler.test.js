import { describe, expect, it, vi } from 'vitest';
import { bindLogoutHandler } from '../src/auth/logout-handler.js';

describe('logout handler', () => {
  it('handles a logout button rendered after auth initialization', () => {
    let clickHandler;
    const document = {
      addEventListener: vi.fn((event, handler) => {
        if (event === 'click') clickHandler = handler;
      }),
    };
    const onLogout = vi.fn();

    bindLogoutHandler(document, onLogout);
    clickHandler({ target: { closest: (selector) => selector === '#logoutBtn' } });

    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('ignores unrelated clicks', () => {
    let clickHandler;
    const document = {
      addEventListener: (_event, handler) => {
        clickHandler = handler;
      },
    };
    const onLogout = vi.fn();

    bindLogoutHandler(document, onLogout);
    clickHandler({ target: { closest: () => false } });

    expect(onLogout).not.toHaveBeenCalled();
  });
});
