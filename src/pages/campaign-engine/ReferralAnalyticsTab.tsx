import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatBDT } from "@/lib/currency";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function ReferralAnalyticsTab() {
  const { data: selections, isLoading } = useQuery({
    queryKey: ["referee-reward-selections-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referee_reward_selections")
        .select("product_id, product_name, product_category, was_selected, discount_value, savings_bdt, original_price_bdt, discounted_price_bdt, referral_program_id, campaign_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const analytics = useMemo(() => {
    if (!selections?.length) return null;

    // Group by product
    const productMap = new Map<string, { name: string; category: string; total: number; selected: number; totalSavings: number }>();
    for (const s of selections) {
      const key = s.product_id;
      if (!productMap.has(key)) {
        productMap.set(key, { name: s.product_name, category: s.product_category, total: 0, selected: 0, totalSavings: 0 });
      }
      const entry = productMap.get(key)!;
      entry.total++;
      if (s.was_selected) {
        entry.selected++;
        entry.totalSavings += Number(s.savings_bdt ?? 0);
      }
    }

    const products = Array.from(productMap.values())
      .map((p) => ({ ...p, rate: p.total > 0 ? Math.round((p.selected / p.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);

    const totalOffered = selections.length;
    const totalSelected = selections.filter((s) => s.was_selected).length;
    const overallRate = totalOffered > 0 ? Math.round((totalSelected / totalOffered) * 100) : 0;
    const totalSavings = selections.filter((s) => s.was_selected).reduce((sum, s) => sum + Number(s.savings_bdt ?? 0), 0);

    return { products, totalOffered, totalSelected, overallRate, totalSavings };
  }, [selections]);

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-12">Loading analytics...</div>;
  }

  if (!analytics || analytics.totalOffered === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-muted-foreground">No referee reward selection data yet.</p>
        <p className="text-xs text-muted-foreground">Analytics will populate as referees interact with reward offers.</p>
      </div>
    );
  }

  const chartData = analytics.products.map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
    rate: p.rate,
    selected: p.selected,
    total: p.total,
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-muted-foreground font-normal">Total Offered</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><div className="text-2xl font-bold">{analytics.totalOffered}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-muted-foreground font-normal">Total Selected</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><div className="text-2xl font-bold text-primary">{analytics.totalSelected}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-muted-foreground font-normal">Overall Selection Rate</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><div className="text-2xl font-bold">{analytics.overallRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-muted-foreground font-normal">Total Savings Given</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3"><div className="text-2xl font-bold text-green-600">{formatBDT(analytics.totalSavings)}</div></CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Selection Rate by Product</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" unit="%" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name: string, props: any) => [`${value}% (${props.payload.selected}/${props.payload.total})`, "Selection Rate"]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Product breakdown table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Product Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-[100px]">Category</TableHead>
                <TableHead className="w-[100px] text-center">Offered</TableHead>
                <TableHead className="w-[100px] text-center">Selected</TableHead>
                <TableHead className="w-[140px]">Selection Rate</TableHead>
                <TableHead className="w-[120px] text-right">Total Savings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.products.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{p.category}</Badge></TableCell>
                  <TableCell className="text-center text-sm">{p.total}</TableCell>
                  <TableCell className="text-center text-sm">{p.selected}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={p.rate} className="h-2 flex-1" />
                      <span className="text-xs font-medium w-10 text-right">{p.rate}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-600 font-medium">{formatBDT(p.totalSavings)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
