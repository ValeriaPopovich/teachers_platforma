export const RECOVERY_INTENT_KEY = 'tutor_auth_recovery';

export function hasRecoveryIntent(url = globalThis.location?.href || '') {
  if (!url) return false;
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  return query.get('type') === 'recovery' || hash.get('type') === 'recovery';
}

export function createAuthFlow({ storage, url } = {}) {
  const recoveryFromUrl = hasRecoveryIntent(url);
  let recovery = recoveryFromUrl || storage?.getItem(RECOVERY_INTENT_KEY) === '1';

  if (recoveryFromUrl) storage?.setItem(RECOVERY_INTENT_KEY, '1');

  function persistRecovery(value) {
    recovery = value;
    if (!storage) return;
    if (value) storage.setItem(RECOVERY_INTENT_KEY, '1');
    else storage.removeItem(RECOVERY_INTENT_KEY);
  }

  return {
    isRecovery() {
      return recovery;
    },
    handleEvent(event) {
      if (event === 'PASSWORD_RECOVERY') persistRecovery(true);
      if (event === 'SIGNED_OUT') persistRecovery(false);
    },
    completeRecovery() {
      persistRecovery(false);
    },
  };
}
