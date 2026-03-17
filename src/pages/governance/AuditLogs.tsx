import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Eye, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "BULK_IMPORT", "STATUS_CHANGE"] as const;
const TARGET_TABLES = [
  "campaign_master", "orders", "products", "inventory_master",
  "admin_users", "admin_roles", "coupons", "referral_programs",
];

const PAGE_SIZE = 15;

type AuditLog = {
  log_id: string;
  admin_id: string | null;
  action_type: string;
  target_table: string;
  target_record_id: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin_users: { full_name: string; email: string } | null;
};

function actionBadgeVariant(action: string) {
  switch (action) {
    case "CREATE": return "default";
    case "DELETE": return "destructive";
    case "UPDATE": return "secondary";
    case "BULK_IMPORT": return "outline";
    default: return "secondary";
  }
}

function JsonDiff({ previous, next }: { previous: Record<string, unknown> | null; next: Record<string, unknown> | null }) {
  const allKeys = Array.from(new Set([
    ...Object.keys(previous || {}),
    ...Object.keys(next || {}),
  ]));

  if (!allKeys.length) {
    return <p className="text-sm text-muted-foreground">No state data recorded.</p>;
  }

  return (
    <div className="font-mono text-xs space-y-1">
      {allKeys.map((key) => {
        const prev = previous?.[key];
        const curr = next?.[key];
        const prevStr = JSON.stringify(prev, null, 2) ?? "null";
        const currStr = JSON.stringify(curr, null, 2) ?? "null";
        const changed = prevStr !== currStr;

        return (
          <div key={key} className={`rounded px-2 py-1 ${changed ? "bg-accent/50 border border-accent" : "bg-muted/50"}`}>
            <span className="font-semibold text-foreground">{key}: </span>
            {changed ? (
              <>
                <span className="text-destructive line-through">{prevStr}</span>
                <span className="mx-1">→</span>
                <span className="text-primary">{currStr}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{currStr}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [tableFilter, setTableFilter] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit_logs", page, actionFilter, tableFilter],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("audit_logs")
        .select("*, admin_users(full_name, email)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (actionFilter !== "ALL") {
        query = query.eq("action_type", actionFilter as any);
      }
      if (tableFilter !== "ALL") {
        query = query.eq("target_table", tableFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as AuditLog[], count: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Immutable trail of all administrative actions</p>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Target Table" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Tables</SelectItem>
            {TARGET_TABLES.map((t) => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(actionFilter !== "ALL" || tableFilter !== "ALL") && (
          <Button variant="ghost" size="sm" onClick={() => { setActionFilter("ALL"); setTableFilter("ALL"); setPage(0); }}>
            Clear Filters
          </Button>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Timestamp</TableHead>
              <TableHead className="w-[120px]">Action</TableHead>
              <TableHead>Target Table</TableHead>
              <TableHead>Record ID</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead className="w-[80px]">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell>
              </TableRow>
            ) : !data?.logs?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No audit logs found.</TableCell>
              </TableRow>
            ) : (
              data.logs.map((log) => (
                <TableRow key={log.log_id}>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {format(new Date(log.created_at), "dd MMM yy, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionBadgeVariant(log.action_type) as any} className="text-xs font-mono">
                      {log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{log.target_table}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[140px]" title={log.target_record_id}>
                    {log.target_record_id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.admin_users ? (
                      <span>{log.admin_users.full_name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)} title="View Details">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages} · {data?.count} total</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Change Details
              {selectedLog && (
                <Badge variant={actionBadgeVariant(selectedLog.action_type) as any} className="text-xs font-mono">
                  {selectedLog.action_type}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Target Table</span>
                  <p>{selectedLog.target_table}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Record ID</span>
                  <p className="font-mono text-xs break-all">{selectedLog.target_record_id}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Performed By</span>
                  <p>{selectedLog.admin_users?.full_name || "System"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Timestamp</span>
                  <p>{format(new Date(selectedLog.created_at), "dd MMM yyyy, HH:mm:ss")}</p>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <span className="font-medium text-muted-foreground">IP Address</span>
                    <p className="font-mono text-xs">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>
              <div>
                <span className="font-medium text-sm text-muted-foreground">State Comparison</span>
                <ScrollArea className="h-[300px] mt-2 rounded-md border p-3">
                  <JsonDiff
                    previous={selectedLog.previous_state as Record<string, unknown> | null}
                    next={selectedLog.new_state as Record<string, unknown> | null}
                  />
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
