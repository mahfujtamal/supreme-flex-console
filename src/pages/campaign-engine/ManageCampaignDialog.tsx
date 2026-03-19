import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TargetingRulesTab from "./TargetingRulesTab";
import ProductRulesTab from "./ProductRulesTab";

interface Props {
  campaignId: string;
  campaignScope: string;
  onClose: () => void;
}

export default function ManageCampaignDialog({ campaignId, campaignScope, onClose }: Props) {
  const [dirty, setDirty] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleClose = () => {
    if (dirty) {
      setConfirmExit(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage Campaign Rules</DialogTitle></DialogHeader>
          <Tabs defaultValue="targeting" className="mt-2">
            <TabsList>
              <TabsTrigger value="targeting">Targeting Rules</TabsTrigger>
              <TabsTrigger value="products">Product Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="targeting">
              <TargetingRulesTab campaignId={campaignId} campaignScope={campaignScope} onDirty={markDirty} />
            </TabsContent>
            <TabsContent value="products">
              <ProductRulesTab campaignId={campaignId} onDirty={markDirty} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to exit? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Discard & Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
