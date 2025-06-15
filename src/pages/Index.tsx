
import { useEffect, useState } from 'react';
import { useDocumentKnowledge } from '@/hooks/useDocumentKnowledge';
import { supabase } from '@/integrations/supabase/client';
import { LandingPage } from '@/components/LandingPage';

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { processDocuments, isProcessing } = useDocumentKnowledge();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      // If authenticated, process documents
      if (session) {
        console.log('User authenticated, processing documents...');
        try {
          const success = await processDocuments();
          if (success) {
            console.log('Documents processed successfully');
          } else {
            console.error('Failed to process documents');
          }
        } catch (error) {
          console.error('Error during document processing:', error);
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      setIsAuthenticated(!!session);

      // Process documents when user signs in
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in, processing documents...');
        try {
          const success = await processDocuments();
          if (success) {
            console.log('Documents processed successfully after sign in');
          } else {
            console.error('Failed to process documents after sign in');
          }
        } catch (error) {
          console.error('Error during document processing after sign in:', error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [processDocuments]);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <LandingPage />
      {isProcessing && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg">
          Processing documents...
        </div>
      )}
    </div>
  );
};

export default Index;
