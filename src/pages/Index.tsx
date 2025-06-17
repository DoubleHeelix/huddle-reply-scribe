
import LandingPage from "@/components/LandingPage";
import { AuthWrapper } from "@/components/AuthWrapper";
import { MainApp } from "@/components/MainApp";

const Index = () => {
  return (
    <main className="bg-gray-900 min-h-screen">
      <AuthWrapper>
        {(user, onSignOut, isAdmin) =>
          user ? (
            <MainApp user={user} onSignOut={onSignOut} isAdmin={isAdmin} />
          ) : (
            <LandingPage />
          )
        }
      </AuthWrapper>
    </main>
  );
};

export default Index;
