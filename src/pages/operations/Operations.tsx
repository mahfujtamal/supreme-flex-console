import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck } from "lucide-react";
import InventoryTab from "./InventoryTab";
import OrderDispatchTab from "./OrderDispatchTab";

const Operations = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Operations</h1>
        <p className="text-muted-foreground">Inventory management, order dispatch & field delivery</p>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" /> Inventory Management
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <Truck className="h-4 w-4" /> Order Dispatch
          </TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="orders">
          <OrderDispatchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Operations;
