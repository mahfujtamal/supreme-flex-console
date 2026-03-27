import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkZonesTab from "./NetworkZonesTab";
import DistrictsTab from "./DistrictsTab";
import AreasTab from "./AreasTab";
import ChannelsTab from "./ChannelsTab";
import SubChannelsTab from "./SubChannelsTab";
import DistributionHousesTab from "./DistributionHousesTab";
import FieldAgentsTab from "./FieldAgentsTab";
import KamsTab from "./KamsTab";
import HubManagersTab from "./HubManagersTab";

export default function MasterData() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Master Data</h1>
        <p className="text-sm text-muted-foreground">
          Manage geography, network, and field infrastructure data
        </p>
      </div>

      <Tabs defaultValue="zones" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="zones">Network Zones</TabsTrigger>
          <TabsTrigger value="districts">Districts</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="sub-channels">Sub-Channels</TabsTrigger>
          <TabsTrigger value="hub-managers">Hub Managers</TabsTrigger>
          <TabsTrigger value="dh">Distribution Houses</TabsTrigger>
          <TabsTrigger value="agents">Field Agents</TabsTrigger>
          <TabsTrigger value="kams">KAMs</TabsTrigger>
        </TabsList>

        <TabsContent value="zones"><NetworkZonesTab /></TabsContent>
        <TabsContent value="districts"><DistrictsTab /></TabsContent>
        <TabsContent value="areas"><AreasTab /></TabsContent>
        <TabsContent value="channels"><ChannelsTab /></TabsContent>
        <TabsContent value="sub-channels"><SubChannelsTab /></TabsContent>
        <TabsContent value="hub-managers"><HubManagersTab /></TabsContent>
        <TabsContent value="dh"><DistributionHousesTab /></TabsContent>
        <TabsContent value="agents"><FieldAgentsTab /></TabsContent>
        <TabsContent value="kams"><KamsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
