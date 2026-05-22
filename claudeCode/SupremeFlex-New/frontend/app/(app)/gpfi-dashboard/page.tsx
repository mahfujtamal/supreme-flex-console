'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface GpfiStats {
  staging: number;
  field_staff: number;
  delivered: number;
}

interface FieldAgent {
  agent_id: string;
  agent_name: string;
  stock_count: number;
  pending_deliveries: number;
}

interface DashboardPayload {
  gpfi: GpfiStats;
  field_execution: FieldAgent[];
}

export default function GPFIDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws/dashboard');
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === 'snapshot' || msg.type === 'update') {
          setSnapshot(msg.data as DashboardPayload);
        }
      } catch { /* ignore malformed frames */ }
    };
    return () => { ws.close(); };
  }, []);

  const stockChartData = snapshot
    ? [
        { name: 'Staging',     count: Number(snapshot.gpfi.staging)    },
        { name: 'Field Staff', count: Number(snapshot.gpfi.field_staff) },
        { name: 'Delivered',   count: Number(snapshot.gpfi.delivered)   },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">GPFI Dashboard</h1>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-600' : 'text-muted-foreground'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <section className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Stock Flow</h2>
        {snapshot ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stockChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Units" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Waiting for data…</p>
        )}
      </section>

      {snapshot?.field_execution && snapshot.field_execution.length > 0 && (
        <section className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Field Agents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-4 font-medium">Agent</th>
                  <th className="text-right py-2 pr-4 font-medium">Stock</th>
                  <th className="text-right py-2 font-medium">Pending Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.field_execution.map(agent => (
                  <tr key={agent.agent_id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 pr-4">{agent.agent_name}</td>
                    <td className="py-2 pr-4 text-right">{agent.stock_count}</td>
                    <td className="py-2 text-right">{agent.pending_deliveries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
