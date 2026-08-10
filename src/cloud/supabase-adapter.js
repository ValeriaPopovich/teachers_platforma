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
      const { data, error } = await client.rpc('save_app_data', {
        p_data: nextData,
        p_expected_revision: expectedRevision,
        p_schema_version: schemaVersion,
      });
      if (error) throw error;
      return data == null
        ? { ok: false, rowsAffected: 0 }
        : { ok: true, rowsAffected: 1, newRevision: +data };
    },
  };
}
