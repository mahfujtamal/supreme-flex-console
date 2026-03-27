import { supabase } from "@/integrations/supabase/client";

export async function logAuditChange(
  tableName: string,
  recordId: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  changedBy: string = "GPFI Sales Manager"
) {
  await supabase.from("system_audit_logs").insert({
    table_name: tableName,
    record_id: recordId,
    old_value: oldValue,
    new_value: newValue,
    changed_by: changedBy,
  } as any);
}
