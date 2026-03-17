import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TargetingRulesTab from "./TargetingRulesTab";
import ProductRulesTab from "./ProductRulesTab";

interface Props {
  campaignId: string;
  onClose: () => void;
}

export default function ManageCampaignDialog({ campaignId, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manage Campaign Rules</DialogTitle></DialogHeader>
        <Tabs defaultValue="targeting" className="mt-2">
          <TabsList>
            <TabsTrigger value="targeting">Targeting Rules</TabsTrigger>
            <TabsTrigger value="products">Product Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="targeting">
            <TargetingRulesTab campaignId={campaignId} />
          </TabsContent>
          <TabsContent value="products">
            <ProductRulesTab campaignId={campaignId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
