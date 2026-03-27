import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

function useGeoTable(table: string, idCol: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const queryKey = [table];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(table).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const id = payload[idCol];
      const isEdit = !!payload._edit;
      const p = { ...payload };
      delete p._edit;
      if (isEdit) {
        const { error } = await (supabase as any).from(table).update(p).eq(idCol, id);
        if (error) throw error;
      } else {
        delete p[idCol];
        const { error } = await (supabase as any).from(table).insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast({ title: "Saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: boolean }) => {
      const { error } = await (supabase as any).from(table).update({ status: !status }).eq(idCol, id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { data: data ?? [], isLoading, save, toggleStatus };
}

function CirclesSection() {
  const { data, isLoading, save, toggleStatus } = useGeoTable("circles", "circle_id");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const close = () => { setOpen(false); setEditId(null); setName(""); };
  const openEdit = (item: any) => { setEditId(item.circle_id); setName(item.circle_name); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Circles</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Circle</Button>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-[80px]">Status</TableHead><TableHead className="w-[60px]" /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
              : !data.length ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No circles yet.</TableCell></TableRow>
              : data.map((c: any) => (
                <TableRow key={c.circle_id}>
                  <TableCell className="font-medium">{c.circle_name}</TableCell>
                  <TableCell><Badge variant={c.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: c.circle_id, status: c.status })}>{c.status ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editId ? "Edit Circle" : "Add Circle"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button disabled={!name.trim() || save.isPending} onClick={() => { save.mutate({ circle_id: editId, circle_name: name.trim(), _edit: !!editId }); close(); }}>
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegionsSection() {
  const { data, isLoading, save, toggleStatus } = useGeoTable("regions", "region_id");
  const { data: circles } = useQuery({ queryKey: ["circles_lookup"], queryFn: async () => { const { data } = await (supabase as any).from("circles").select("circle_id, circle_name").eq("status", true); return (data ?? []) as any[]; } });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [circleId, setCircleId] = useState("");

  const close = () => { setOpen(false); setEditId(null); setName(""); setCircleId(""); };
  const openEdit = (item: any) => { setEditId(item.region_id); setName(item.region_name); setCircleId(item.circle_id); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Regions</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Region</Button>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Circle</TableHead><TableHead className="w-[80px]">Status</TableHead><TableHead className="w-[60px]" /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
              : !data.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No regions yet.</TableCell></TableRow>
              : data.map((r: any) => (
                <TableRow key={r.region_id}>
                  <TableCell className="font-medium">{r.region_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{circles?.find((c: any) => c.circle_id === r.circle_id)?.circle_name ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: r.region_id, status: r.status })}>{r.status ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editId ? "Edit Region" : "Add Region"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
            <div><Label>Circle</Label>
              <Select value={circleId} onValueChange={setCircleId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select circle" /></SelectTrigger>
                <SelectContent>{circles?.map((c: any) => <SelectItem key={c.circle_id} value={c.circle_id}>{c.circle_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button disabled={!name.trim() || !circleId || save.isPending} onClick={() => { save.mutate({ region_id: editId, region_name: name.trim(), circle_id: circleId, _edit: !!editId }); close(); }}>
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClustersSection() {
  const { data, isLoading, save, toggleStatus } = useGeoTable("clusters", "cluster_id");
  const { data: regions } = useQuery({ queryKey: ["regions_lookup"], queryFn: async () => { const { data } = await (supabase as any).from("regions").select("region_id, region_name").eq("status", true); return (data ?? []) as any[]; } });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");

  const close = () => { setOpen(false); setEditId(null); setName(""); setRegionId(""); };
  const openEdit = (item: any) => { setEditId(item.cluster_id); setName(item.cluster_name); setRegionId(item.region_id); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Clusters</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Cluster</Button>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Region</TableHead><TableHead className="w-[80px]">Status</TableHead><TableHead className="w-[60px]" /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
              : !data.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No clusters yet.</TableCell></TableRow>
              : data.map((c: any) => (
                <TableRow key={c.cluster_id}>
                  <TableCell className="font-medium">{c.cluster_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{regions?.find((r: any) => r.region_id === c.region_id)?.region_name ?? "—"}</TableCell>
                  <TableCell><Badge variant={c.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: c.cluster_id, status: c.status })}>{c.status ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editId ? "Edit Cluster" : "Add Cluster"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
            <div><Label>Region</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>{regions?.map((r: any) => <SelectItem key={r.region_id} value={r.region_id}>{r.region_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button disabled={!name.trim() || !regionId || save.isPending} onClick={() => { save.mutate({ cluster_id: editId, cluster_name: name.trim(), region_id: regionId, _edit: !!editId }); close(); }}>
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TerritoriesSection() {
  const { data, isLoading, save, toggleStatus } = useGeoTable("territories", "territory_id");
  const { data: clusters } = useQuery({ queryKey: ["clusters_lookup"], queryFn: async () => { const { data } = await (supabase as any).from("clusters").select("cluster_id, cluster_name").eq("status", true); return (data ?? []) as any[]; } });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [clusterId, setClusterId] = useState("");

  const close = () => { setOpen(false); setEditId(null); setName(""); setClusterId(""); };
  const openEdit = (item: any) => { setEditId(item.territory_id); setName(item.territory_name); setClusterId(item.cluster_id); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Territories</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Territory</Button>
      </div>
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Cluster</TableHead><TableHead className="w-[80px]">Status</TableHead><TableHead className="w-[60px]" /></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
              : !data.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No territories yet.</TableCell></TableRow>
              : data.map((t: any) => (
                <TableRow key={t.territory_id}>
                  <TableCell className="font-medium">{t.territory_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{clusters?.find((c: any) => c.cluster_id === t.cluster_id)?.cluster_name ?? "—"}</TableCell>
                  <TableCell><Badge variant={t.status ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus.mutate({ id: t.territory_id, status: t.status })}>{t.status ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={v => { if (!v) close(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editId ? "Edit Territory" : "Add Territory"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
            <div><Label>Cluster</Label>
              <Select value={clusterId} onValueChange={setClusterId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select cluster" /></SelectTrigger>
                <SelectContent>{clusters?.map((c: any) => <SelectItem key={c.cluster_id} value={c.cluster_id}>{c.cluster_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button disabled={!name.trim() || !clusterId || save.isPending} onClick={() => { save.mutate({ territory_id: editId, territory_name: name.trim(), cluster_id: clusterId, _edit: !!editId }); close(); }}>
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GeographyTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Manage the geography hierarchy: Circle → Region → Cluster → Territory</p>
      <Tabs defaultValue="circles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="circles">Circles</TabsTrigger>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
          <TabsTrigger value="territories">Territories</TabsTrigger>
        </TabsList>
        <TabsContent value="circles"><CirclesSection /></TabsContent>
        <TabsContent value="regions"><RegionsSection /></TabsContent>
        <TabsContent value="clusters"><ClustersSection /></TabsContent>
        <TabsContent value="territories"><TerritoriesSection /></TabsContent>
      </Tabs>
    </div>
  );
}
