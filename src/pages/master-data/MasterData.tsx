import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NetworkZonesTab from "./NetworkZonesTab";
import DistrictsTab from "./DistrictsTab";
import AreasTab from "./AreasTab";
import ChannelsTab from "./ChannelsTab";
import SubChannelsTab from "./SubChannelsTab";

export default function MasterData() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Master Data</h1>
        <p className="text-sm text-muted-foreground">
          Manage geography and network configuration data
        </p>
      </div>

      <Tabs defaultValue="zones" className="space-y-4">
        <TabsList>
          <TabsTrigger value="zones">Network Zones</TabsTrigger>
          <TabsTrigger value="districts">Districts</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="sub-channels">Sub-Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="zones"><NetworkZonesTab /></TabsContent>
        <TabsContent value="districts"><DistrictsTab /></TabsContent>
        <TabsContent value="areas"><AreasTab /></TabsContent>
        <TabsContent value="channels"><ChannelsTab /></TabsContent>
        <TabsContent value="sub-channels"><SubChannelsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
