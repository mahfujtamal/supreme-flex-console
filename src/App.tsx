import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import RoleManagement from "./pages/governance/RoleManagement";
import MasterData from "./pages/master-data/MasterData";
import ProductEngine from "./pages/product-engine/ProductEngine";
import PricingEngine from "./pages/pricing-engine/PricingEngine";
import CampaignEngine from "./pages/campaign-engine/CampaignEngine";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route path="/governance/roles" element={<RoleManagement />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
