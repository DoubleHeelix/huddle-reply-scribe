
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { AuthContext } from '@/hooks/useAuth';
import { hasAdminRole } from '@/utils/adminRole';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper = ({ children }: AuthWrapperProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const handleAuthFromUrl = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');

      if (!code) return;

      setLoading(true);

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!isMounted) return;

      if (error) {
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(hasAdminRole(currentUser));

      toast({
        title: "Email confirmed",
        description: "You're now signed in.",
      });

      // Remove auth params from the URL so we don't re-run the exchange.
      const cleanedParams = new URLSearchParams(window.location.search);
      cleanedParams.delete('code');
      cleanedParams.delete('type');
      const cleanedUrl = `${window.location.pathname}${cleanedParams.toString() ? `?${cleanedParams}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanedUrl);
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setIsAdmin(hasAdminRole(currentUser));
        setLoading(false);
      }
    );

    // Check for existing session
    const initializeSession = async () => {
      await handleAuthFromUrl();

      if (!isMounted) return;

      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user ?? null;

      if (session) {
        const { data: refreshedAuth, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError) {
          console.warn('Unable to refresh account permissions', {
            name: refreshError.name,
          });
        } else {
          currentUser =
            refreshedAuth.session?.user ??
            refreshedAuth.user ??
            currentUser;
        }
      }

      setUser(currentUser);
      setIsAdmin(hasAdminRole(currentUser));
      setLoading(false);
    };

    initializeSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [toast]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Sign Out Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4efe7] flex items-center justify-center dark:bg-[#0d0c0b]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c49b5d] mx-auto mb-4"></div>
          <p className="text-[#29231c] font-sans dark:text-[#f4efe7]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, onSignOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};
