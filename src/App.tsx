import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import FlowPage from "./pages/FlowPage";
import { AuthWrapper } from "./components/AuthWrapper";

const queryClient = new QueryClient();

const AppRoute = () => {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return <Index />;
  if (pathname === "/flow") return <FlowPage />;
  return <NotFound />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthWrapper>
        <Toaster />
        <Sonner />
        <AppRoute />
      </AuthWrapper>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
