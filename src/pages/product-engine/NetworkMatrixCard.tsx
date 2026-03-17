import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export default function NetworkMatrixCard() {
  const rules = [
    { category: "WIFI_PLAN & DIGITAL ADDON", rule: "STRICT network match required (4G/5G)", badge: "Strict" },
    { category: "CPE", rule: "RELAXED — e.g. 5G router can be purchased in 4G-only area", badge: "Relaxed" },
    { category: "PHYSICAL ADDON", rule: "Depends on CPE compatibility mapping", badge: "Mapped" },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Network Eligibility Matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {rules.map((r) => (
            <div key={r.category} className="flex items-start gap-3 text-sm">
              <Badge variant="outline" className="shrink-0 text-xs">{r.badge}</Badge>
              <div>
                <span className="font-medium text-foreground">{r.category}:</span>{" "}
                <span className="text-muted-foreground">{r.rule}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
