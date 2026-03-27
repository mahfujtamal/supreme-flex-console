import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevModeProvider } from "@/contexts/DevModeContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import MasterData from "./pages/master-data/MasterData";
import ProductEngine from "./pages/product-engine/ProductEngine";
import PricingEngine from "./pages/pricing-engine/PricingEngine";
import CampaignEngine from "./pages/campaign-engine/CampaignEngine";
import Operations from "./pages/operations/Operations";
import Governance from "./pages/governance/Governance";
import AuditLogs from "./pages/governance/AuditLogs";
import CustomersPage from "./pages/customers/CustomersPage";
import InvoicingPage from "./pages/invoicing/InvoicingPage";
import AssetLifecyclePage from "./pages/assets/AssetLifecyclePage";
import BulkInwardingPage from "./pages/inventory/BulkInwardingPage";
import StockTransfersPage from "./pages/inventory/StockTransfersPage";
import GpfiDashboard from "./pages/dashboards/GpfiDashboard";
import HubManagerDashboard from "./pages/dashboards/HubManagerDashboard";
import FieldExecutionDashboard from "./pages/dashboards/FieldExecutionDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DevModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/master-data" element={<MasterData />} />
              <Route path="/product-engine" element={<ProductEngine />} />
              <Route path="/pricing-engine" element={<PricingEngine />} />
              <Route path="/campaign-engine" element={<CampaignEngine />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/governance" element={<Governance />} />
              <Route path="/logs" element={<AuditLogs />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/invoicing" element={<InvoicingPage />} />
              <Route path="/assets" element={<AssetLifecyclePage />} />
              <Route path="/bulk-inwarding" element={<BulkInwardingPage />} />
              <Route path="/stock-transfers" element={<StockTransfersPage />} />
              <Route path="/gpfi-dashboard" element={<GpfiDashboard />} />
              <Route path="/hub-manager-dashboard" element={<HubManagerDashboard />} />
              <Route path="/field-execution" element={<FieldExecutionDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </DevModeProvider>
  </QueryClientProvider>
);

export default App;
