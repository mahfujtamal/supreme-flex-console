import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, KeyRound } from "lucide-react";
import AdminRolesTab from "./AdminRolesTab";
import AdminUsersTab from "./AdminUsersTab";
import RoleManagement from "./RoleManagement";

export default function Governance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Governance</h1>
        <p className="text-sm text-muted-foreground">
          Manage admin roles, users, and access control
        </p>
      </div>
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" /> Admin Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="h-4 w-4" /> Admin Roles
          </TabsTrigger>
          <TabsTrigger value="role-management" className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Roles & Permissions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <AdminUsersTab />
        </TabsContent>
        <TabsContent value="roles">
          <AdminRolesTab />
        </TabsContent>
        <TabsContent value="role-management">
          <RoleManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
