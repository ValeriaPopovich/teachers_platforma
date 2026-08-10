export const SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  OFFLINE: 'offline',
  ERROR: 'error',
  CONFLICT: 'conflict',
});
export async function initialLoad(client, userId) {
  try {
    const row = await client.loadRow(userId);
    if (!row) return { ok: true, data: null, revision: 0, schemaVersion: 1 };
    return {
      ok: true,
      data: row.data,
      revision: +row.revision || 0,
      schemaVersion: +row.schemaVersion || 1,
    };
  } catch (error) {
    return { ok: false, error };
  }
}
export async function saveWithCas(client, { userId, nextData, expectedRevision }) {
  try {
    const result = await client.updateRow({ userId, nextData, expectedRevision });
    if (!result || typeof result !== 'object')
      return { status: SYNC_STATUS.ERROR, error: new Error('empty response') };
    if (result.rowsAffected === 0) return { status: SYNC_STATUS.CONFLICT };
    if (result.ok && Number.isFinite(result.newRevision))
      return { status: SYNC_STATUS.SAVED, newRevision: result.newRevision };
    return { status: SYNC_STATUS.ERROR, error: new Error('malformed response') };
  } catch (error) {
    const message = String(error?.message || error || '');
    return /network|failed to fetch|offline/i.test(message)
      ? { status: SYNC_STATUS.OFFLINE, error }
      : { status: SYNC_STATUS.ERROR, error };
  }
}
export function createSaveQueue() {
  let chain = Promise.resolve();
  return {
    enqueue(job) {
      const next = chain.then(() => job()).catch((error) => ({ status: SYNC_STATUS.ERROR, error }));
      chain = next.catch(() => {});
      return next;
    },
  };
}
