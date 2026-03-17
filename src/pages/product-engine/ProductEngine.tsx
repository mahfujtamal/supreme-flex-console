import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductCatalogTab from "./ProductCatalogTab";
import AddonCompatibilityTab from "./AddonCompatibilityTab";
import NetworkMatrixCard from "./NetworkMatrixCard";

export default function ProductEngine() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Product Engine</h1>
        <p className="text-sm text-muted-foreground">Manage product catalog, addon compatibility, and network rules.</p>
      </div>

      <NetworkMatrixCard />

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList>
          <TabsTrigger value="catalog">Product Catalog</TabsTrigger>
          <TabsTrigger value="compatibility">Addon Compatibility</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog"><ProductCatalogTab /></TabsContent>
        <TabsContent value="compatibility"><AddonCompatibilityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
