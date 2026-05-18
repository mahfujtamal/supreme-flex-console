'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Database, Box, DollarSign, Megaphone, Settings,
  Users, Receipt, HardDrive, PackagePlus, ArrowRightLeft, Gauge,
  Building2, ScanLine, Shield, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Dashboard',        href: '/',                        icon: LayoutDashboard },
  { title: 'Master Data',      href: '/master-data',             icon: Database },
  { title: 'Product Engine',   href: '/product-engine',          icon: Box },
  { title: 'Pricing Engine',   href: '/pricing-engine',          icon: DollarSign },
  { title: 'Campaign Engine',  href: '/campaign-engine',         icon: Megaphone },
  { title: 'Operations',       href: '/operations',              icon: Settings },
  { title: 'Customers',        href: '/customers',               icon: Users },
  { title: 'Invoicing',        href: '/invoicing',               icon: Receipt },
  { title: 'Asset Lifecycle',  href: '/assets',                  icon: HardDrive },
  { title: 'Bulk Inwarding',   href: '/bulk-inwarding',          icon: PackagePlus },
  { title: 'Stock Transfers',  href: '/stock-transfers',         icon: ArrowRightLeft },
  { title: 'GPFI Dashboard',   href: '/gpfi-dashboard',          icon: Gauge },
  { title: 'Hub Manager',      href: '/hub-manager-dashboard',   icon: Building2 },
  { title: 'Field Execution',  href: '/field-execution',         icon: ScanLine },
  { title: 'Governance',       href: '/governance',              icon: Shield },
  { title: 'Logs',             href: '/logs',                    icon: FileText },
];

export function AppSidebar() {
  const pathname  = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'flex flex-col border-r bg-background transition-all duration-200',
      collapsed ? 'w-14' : 'w-56'
    )}>
      {/* Branding */}
      <div className="flex items-center justify-between px-3 py-4 border-b">
        {!collapsed && <span className="font-bold text-sm">SupremeFlex</span>}
        <button onClick={() => setCollapsed(c => !c)} className="p-1 rounded hover:bg-muted">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(({ title, href, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? title : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 mx-1 rounded text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{title}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
