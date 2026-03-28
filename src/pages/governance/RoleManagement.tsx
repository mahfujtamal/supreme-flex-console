import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plus, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import RoleUsersDialog from "./RoleUsersDialog";

const PAGE_SIZE = 10;

export default function RoleManagement() {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedRole, setSelectedRole] = useState<{ role_id: string; role_name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["roles", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("role_master")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { roles: data, count: count ?? 0 };
    },
  });

  const { data: roleCounts } = useQuery({
    queryKey: ["role_user_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_role").select("role_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        counts[r.role_id] = (counts[r.role_id] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: rolePermissions } = useQuery({
    queryKey: ["role_permissions_map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permission")
        .select("role_id, permission_master(permission_name, module)");
      if (error) throw error;
      const map: Record<string, { permission_name: string; module: string }[]> = {};
      data.forEach((rp: any) => {
        if (!map[rp.role_id]) map[rp.role_id] = [];
        if (rp.permission_master) map[rp.role_id].push(rp.permission_master);
      });
      return map;
    },
  });

  const createRole = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("role_master")
        .insert({ role_name: roleName, role_description: roleDesc });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false);
      setRoleName("");
      setRoleDesc("");
      toast({ title: "Role created", description: `"${roleName}" has been added.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Role Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage roles, descriptions, and assigned users
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Role
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="w-[100px]">Users</TableHead>
              <TableHead className="w-[160px]">Created At</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell>
              </TableRow>
            ) : !data?.roles?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No roles found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              data.roles.map((role) => {
                const perms = rolePermissions?.[role.role_id] ?? [];
                const modules = [...new Set(perms.map(p => p.module))];
                return (
                  <TableRow key={role.role_id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-medium">
                        {role.role_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {role.role_description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {modules.length ? modules.map(m => (
                          <Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">
                            {m} ({perms.filter(p => p.module === m).length})
                          </Badge>
                        )) : <span className="text-xs text-muted-foreground">None</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" />
                        {roleCounts?.[role.role_id] ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(role.created_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedRole({ role_id: role.role_id, role_name: role.role_name })}
                        title="View assigned users"
                      >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages} · {data?.count} total
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input id="role-name" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Campaign Manager" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea id="role-desc" value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="Describe the role's responsibilities..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createRole.mutate()} disabled={!roleName.trim() || createRole.isPending}>
              {createRole.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedRole && (
        <RoleUsersDialog
          roleId={selectedRole.role_id}
          roleName={selectedRole.role_name}
          open={!!selectedRole}
          onOpenChange={(open) => { if (!open) setSelectedRole(null); }}
        />
      )}
    </div>
  );
}
