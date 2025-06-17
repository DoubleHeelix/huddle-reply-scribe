
import LandingPage from "@/components/LandingPage";
import { MainApp } from "@/components/MainApp";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user } = useAuth();

  return (
    <main className="bg-gray-900 min-h-screen">
      {user ? <MainApp /> : <LandingPage />}
    </main>
  );
};

export default Index;
