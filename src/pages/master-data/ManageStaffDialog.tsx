import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Search, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

interface Props {
  subChannelId: string;
  subChannelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageStaffDialog({ subChannelId, subChannelName, open, onOpenChange }: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [role, setRole] = useState("Agent");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sub_channel_users", subChannelId, page, search],
    queryFn: async () => {
      let q = supabase
        .from("sub_channel_users")
        .select("*", { count: "exact" })
        .eq("sub_channel_id", subChannelId)
        .order("created_at", { ascending: false });
      if (search) q = q.or(`user_name.ilike.%${search}%,employee_id.ilike.%${search}%,msisdn.ilike.%${search}%`);
      const { data, error, count } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data, count: count ?? 0 };
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        sub_channel_id: subChannelId,
        user_name: userName,
        employee_id: employeeId,
        msisdn,
        role,
      };
      if (editId) {
        const { error } = await supabase.from("sub_channel_users").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sub_channel_users").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub_channel_users", subChannelId] });
      closeForm();
      toast({ title: editId ? "Staff updated" : "Staff added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const { error } = await supabase.from("sub_channel_users").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sub_channel_users", subChannelId] }),
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("sub_channel_users").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub_channel_users", subChannelId] });
      setBulkOpen(false);
      setCsvRows([]);
      toast({ title: `${csvRows.length} staff imported` });
    },
    onError: (e: Error) => toast({ title: "Import error", description: e.message, variant: "destructive" }),
  });

  const closeForm = () => {
    setFormOpen(false);
    setEditId(null);
    setUserName("");
    setEmployeeId("");
    setMsisdn("");
    setRole("Agent");
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setUserName(item.user_name);
    setEmployeeId(item.employee_id);
    setMsisdn(item.msisdn);
    setRole(item.role);
    setFormOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { setCsvErrors(["File is empty or has no data rows"]); return; }
      const header = lines[0].toLowerCase();
      if (!header.includes("employee_id") || !header.includes("user_name") || !header.includes("msisdn")) {
        setCsvErrors(["CSV must have columns: employee_id, user_name, msisdn, role (optional)"]);
        return;
      }
      const rows: any[] = [];
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols.length < 3) { errors.push(`Row ${i + 1}: too few columns`); continue; }
        rows.push({
          sub_channel_id: subChannelId,
          employee_id: cols[0],
          user_name: cols[1],
          msisdn: cols[2],
          role: cols[3] || "Agent",
        });
      }
      setCsvRows(rows);
      setCsvErrors(errors);
    };
    reader.readAsText(file);
  };

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Staff — {subChannelName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative max-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search staff..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />Bulk Upload
              </Button>
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Add Staff
              </Button>
            </div>
          </div>

          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>MSISDN</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
                ) : !data?.items?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No staff members yet.</TableCell></TableRow>
                ) : data.items.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.user_name}</TableCell>
                    <TableCell className="font-mono text-xs">{u.employee_id}</TableCell>
                    <TableCell className="text-sm">{u.msisdn}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{u.role}</Badge></TableCell>
                    <TableCell>
                      <Badge
                        variant={u.status === "ACTIVE" ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleStatus.mutate({ id: u.id, status: u.status })}
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Staff Form */}
        <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); else setFormOpen(true); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editId ? "Edit Staff" : "Add Staff"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="e.g. Karim Ahmed" />
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP-1234" disabled={!!editId} />
              </div>
              <div className="space-y-2">
                <Label>MSISDN</Label>
                <Input value={msisdn} onChange={(e) => setMsisdn(e.target.value)} placeholder="e.g. 01712345678" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agent">Agent</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!userName.trim() || !employeeId.trim() || !msisdn.trim() || save.isPending}>
                {save.isPending ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Upload Dialog */}
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Bulk Upload Staff</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                CSV format: <code>employee_id, user_name, msisdn, role</code> (role is optional, defaults to Agent)
              </p>
              <Input type="file" accept=".csv" onChange={handleFileUpload} />
              {csvErrors.length > 0 && (
                <div className="text-xs text-destructive space-y-1">
                  {csvErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              {csvRows.length > 0 && (
                <p className="text-sm text-muted-foreground">{csvRows.length} rows ready to import</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button onClick={() => bulkImport.mutate(csvRows)} disabled={!csvRows.length || bulkImport.isPending}>
                {bulkImport.isPending ? "Importing..." : `Import ${csvRows.length} rows`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
