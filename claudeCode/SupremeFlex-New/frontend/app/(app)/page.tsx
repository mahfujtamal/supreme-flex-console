'use client';

import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <LayoutDashboard size={48} className="text-muted-foreground" />
      <h1 className="text-3xl font-bold">Welcome to SupremeFlex</h1>
      <p className="text-muted-foreground max-w-md">
        Select a module from the sidebar to get started. Use the navigation to manage
        master data, products, pricing, campaigns, customers, and more.
      </p>
      <Link href="/gpfi-dashboard" className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
        View GPFI Dashboard
      </Link>
    </div>
  );
}
