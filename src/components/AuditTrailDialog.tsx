import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  recordId: string;
  title?: string;
}

export default function AuditTrailDialog({ open, onOpenChange, tableName, recordId, title }: Props) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["system_audit_logs", tableName, recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!recordId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit Trail{title ? ` — ${title}` : ""}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : !logs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No changes recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log: any) => {
                const oldVal = log.old_value as Record<string, unknown> | null;
                const newVal = log.new_value as Record<string, unknown> | null;
                const allKeys = Array.from(new Set([
                  ...Object.keys(oldVal || {}),
                  ...Object.keys(newVal || {}),
                ]));
                const changedKeys = allKeys.filter(k => JSON.stringify(oldVal?.[k]) !== JSON.stringify(newVal?.[k]));

                return (
                  <div key={log.log_id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">
                        {format(new Date(log.changed_at), "dd MMM yyyy, HH:mm:ss")}
                      </span>
                      <Badge variant="outline" className="text-xs">{log.changed_by}</Badge>
                    </div>
                    <div className="space-y-1">
                      {changedKeys.map(key => (
                        <div key={key} className="text-xs font-mono bg-muted/50 rounded px-2 py-1">
                          <span className="font-semibold text-foreground">{key}: </span>
                          <span className="text-destructive line-through">{JSON.stringify(oldVal?.[key] ?? null)}</span>
                          <span className="mx-1">→</span>
                          <span className="text-primary">{JSON.stringify(newVal?.[key] ?? null)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
