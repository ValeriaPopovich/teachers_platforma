// Адаптер поверх supabase-js, реализующий контракт client'а для sync-protocol.js.
// Пока НЕ подключён в assets/auth.js — переключение будет отдельным маленьким шагом
// ПОСЛЕ применения миграции supabase/migrations/2026_stage5_add_revision_cas.sql.
// См. docs/CLOUD_SYNC_SETUP.md — там пошагово diff, который надо внести в auth.js.

/**
 * @param {object} client — supabase client (createClient(...)).
 * @returns {{loadRow, updateRow}} — контракт для src/cloud/sync-protocol.js.
 */
export function createSupabaseCloudClient(client) {
  return {
    async loadRow(userId) {
      const { data, error } = await client
        .from('app_data')
        .select('data, revision, schema_version, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        data: data.data,
        revision: +data.revision || 0,
        schemaVersion: +data.schema_version || 1,
      };
    },

    async updateRow({ nextData, expectedRevision, schemaVersion = 1 }) {
      // Атомарный CAS через RPC. Возвращает новую revision или null (=conflict).
      const { data, error } = await client.rpc('save_app_data', {
        p_data: nextData,
        p_expected_revision: expectedRevision,
        p_schema_version: schemaVersion,
      });
      if (error) throw error;
      if (data == null) {
        return { ok: false, rowsAffected: 0 };
      }
      return { ok: true, rowsAffected: 1, newRevision: +data };
    },
  };
}
