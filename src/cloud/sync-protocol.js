// Клиентский протокол cloud sync с серверной optimistic concurrency (ADR-0006, §5 спеки).
// Функции чистые: получают "клиент" как объект с методами loadRow/updateRow, никакой сети
// сами не делают. Это позволяет протестировать всю логику детерминированно.
//
// Контракт сервера:
//   app_data (user_id, data, schema_version, revision, updated_at)
//   loadRow(userId) -> { data, revision, schemaVersion } | null
//   updateRow({ userId, nextData, expectedRevision }) -> {
//     ok: boolean,           // true если строка обновлена
//     rowsAffected: number,  // 0 = конфликт
//     newRevision?: number,  // новая revision при ok:true
//   }
//
// Статусы: см. SYNC_STATUS.

export const SYNC_STATUS = Object.freeze({
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  OFFLINE: 'offline',
  ERROR: 'error',
  CONFLICT: 'conflict',
});

/**
 * Первичная загрузка. Устанавливает base revision клиента.
 * @param {object} client — { loadRow(userId) => {data,revision,schemaVersion}|null }
 * @returns {Promise<{ok, data, revision, schemaVersion, error?}>}
 */
export async function initialLoad(client, userId) {
  try {
    const row = await client.loadRow(userId);
    if (!row) {
      return { ok: true, data: null, revision: 0, schemaVersion: 1 };
    }
    return {
      ok: true,
      data: row.data,
      revision: +row.revision || 0,
      schemaVersion: +row.schemaVersion || 1,
    };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/**
 * Save одного snapshot с CAS. Не автоматически перезаписывает более новую версию.
 * @param {object} client
 * @param {object} args — { userId, nextData, expectedRevision }
 * @returns {Promise<{ status, newRevision?, error? }>}
 *          status ∈ { SAVED, CONFLICT, OFFLINE, ERROR }
 */
export async function saveWithCas(client, { userId, nextData, expectedRevision }) {
  try {
    const res = await client.updateRow({ userId, nextData, expectedRevision });
    if (!res || typeof res !== 'object') {
      return { status: SYNC_STATUS.ERROR, error: new Error('empty response') };
    }
    if (res.rowsAffected === 0) {
      return { status: SYNC_STATUS.CONFLICT };
    }
    if (res.ok && Number.isFinite(res.newRevision)) {
      return { status: SYNC_STATUS.SAVED, newRevision: res.newRevision };
    }
    return { status: SYNC_STATUS.ERROR, error: new Error('malformed response') };
  } catch (err) {
    // Отличаем offline (нет сети) от прочих ошибок по имени/сообщению.
    const msg = String(err?.message || err || '');
    if (/network|failed to fetch|offline/i.test(msg)) {
      return { status: SYNC_STATUS.OFFLINE, error: err };
    }
    return { status: SYNC_STATUS.ERROR, error: err };
  }
}

/**
 * Sequential save queue. Гарантирует, что в один момент времени не больше одного
 * save-запроса. Debounce отдельно — снаружи (см. заметку в §5 спеки).
 * Возвращает объект с методом enqueue(job): Promise<result>.
 */
export function createSaveQueue() {
  let chain = Promise.resolve();
  return {
    enqueue(job) {
      const next = chain
        .then(() => job())
        .catch((err) => ({ status: SYNC_STATUS.ERROR, error: err }));
      // Не даём одному падению убить chain — тихо гасим.
      chain = next.catch(() => {});
      return next;
    },
  };
}
