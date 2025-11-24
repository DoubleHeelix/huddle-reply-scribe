
import LandingPage from "@/components/LandingPage";
import { MainApp } from "@/components/MainApp";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user } = useAuth();

  return (
    <main className="bg-slate-950 min-h-screen">
      {user ? <MainApp /> : <LandingPage />}
    </main>
  );
};

export default Index;
