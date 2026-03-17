import { LayoutDashboard } from "lucide-react";

const Index = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Welcome to SupremeFlex. Select a module from the sidebar.
      </p>
    </div>
  );
};

export default Index;
