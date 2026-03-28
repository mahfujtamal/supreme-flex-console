import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface RoleUsersDialogProps {
  roleId: string;
  roleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RoleUsersDialog({ roleId, roleName, open, onOpenChange }: RoleUsersDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: assignedUsers, isLoading } = useQuery({
    queryKey: ["role_users", roleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_role")
        .select("user_id")
        .eq("role_id", roleId);
      if (error) throw error;
      const userIds = data.map((r) => r.user_id);
      if (!userIds.length) return [];
      const { data: users, error: ue } = await supabase
        .from("user_account")
        .select("user_id, user_name, employee_id, email, staff_type")
        .in("user_id", userIds);
      if (ue) throw ue;
      return users;
    },
    enabled: open,
  });

  const { data: unassignedUsers } = useQuery({
    queryKey: ["unassigned_users_for_role", roleId],
    queryFn: async () => {
      const { data: assigned, error: ae } = await supabase
        .from("user_role")
        .select("user_id")
        .eq("role_id", roleId);
      if (ae) throw ae;
      const assignedIds = assigned.map((r) => r.user_id);

      let query = supabase.from("user_account").select("user_id, user_name, employee_id, email").order("user_name").limit(200);
      if (assignedIds.length > 0) {
        query = query.not("user_id", "in", `(${assignedIds.join(",")})`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const assignUser = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_role").insert({ user_id: selectedUserId, role_id: roleId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_users", roleId] });
      qc.invalidateQueries({ queryKey: ["unassigned_users_for_role", roleId] });
      qc.invalidateQueries({ queryKey: ["role_user_counts"] });
      setSelectedUserId("");
      toast({ title: "User assigned", description: `User added to ${roleName}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_role")
        .delete()
        .eq("user_id", userId)
        .eq("role_id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role_users", roleId] });
      qc.invalidateQueries({ queryKey: ["unassigned_users_for_role", roleId] });
      qc.invalidateQueries({ queryKey: ["role_user_counts"] });
      toast({ title: "User removed" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Users assigned to "{roleName}"</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user to assign..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedUsers?.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.user_name} ({u.employee_id || u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!selectedUserId || assignUser.isPending} onClick={() => assignUser.mutate()}>
            <UserPlus className="h-4 w-4 mr-1" /> Assign
          </Button>
        </div>

        <div className="border rounded-lg overflow-auto flex-1 min-h-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Staff Type</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading...</TableCell>
                </TableRow>
              ) : !assignedUsers?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">No users assigned to this role.</TableCell>
                </TableRow>
              ) : (
                assignedUsers.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.user_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.employee_id || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{u.staff_type || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeUser.mutate(u.user_id)} title="Remove from role">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
