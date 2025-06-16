
import { useState } from "react";
import LandingPage from "@/components/LandingPage";
import { AuthWrapper } from "@/components/AuthWrapper";
import { MainApp } from "@/components/MainApp";

const Index = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleGetStarted = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsTransitioning(false);
    }, 500);
  };

  return (
    <main className="bg-gray-900 min-h-screen">
      <AuthWrapper>
        {(user, onSignOut) =>
          showLanding ? (
            <div className={`transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              <LandingPage onGetStarted={handleGetStarted} />
            </div>
          ) : (
            <MainApp user={user} onSignOut={onSignOut} />
          )
        }
      </AuthWrapper>
    </main>
  );
};

export default Index;
