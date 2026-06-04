import { describe, it, expect } from 'vitest';
import { getAdminSupabase } from '@/lib/api/admin';

// These tests require a running Supabase instance and the following env:
// SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_PUBLISHABLE_KEY

describe('audit.changed_by (integration)', async () => {
  it('service-role write sets audit.changed_by via RPC', async () => {
    const svc = getAdminSupabase();
    const actor = crypto.randomUUID();

    // set the session GUC to the actor
    await svc.rpc('set_audit_changed_by', { audit_uid: actor });

    // perform a write that should be audited (customers table assumed)
    const name = `test-audit-${Date.now()}`;
    const { error: insertError } = await svc.from('customers').insert({ name });
    expect(insertError).toBeNull();

    // read the most recent audit log for customers
    const { data: logs } = await svc.from('audit_logs').select('*').eq('table_name', 'customers').order('changed_at', { ascending: false }).limit(1);
    expect(logs && logs.length > 0).toBeTruthy();
    if (logs && logs.length > 0) {
      expect(logs[0].changed_by).toBe(actor);
    }
  });
});
