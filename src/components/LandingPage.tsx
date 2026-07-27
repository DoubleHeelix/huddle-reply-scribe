
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { Sparkles, Mail, Lock, UserPlus, LogIn, ShieldCheck, Bot } from "lucide-react";
import { getAuthRedirectUrl } from "@/utils/nativeApp";

const LandingPage = () => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    }

    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const redirectUrl = getAuthRedirectUrl();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { role: 'user' },
      }
    });

    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    }

    setIsSubmitting(false);
  };

  const features = [
    { icon: Sparkles, title: "Sharper replies", copy: "AI suggestions tuned for empathy and clarity." },
    { icon: ShieldCheck, title: "Context aware", copy: "Grounded by your huddles and documents." },
    { icon: Bot, title: "Voice to text", copy: "Draft by speaking, refine in seconds." },
  ];
  const isSignup = authMode === 'signup';

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-[#f4efe7] text-[#29231c] dark:bg-[#0d0c0b] dark:text-[#f4efe7]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-70 dark:opacity-60">
        <div className="pattern-grid absolute inset-0" />
        <div className="absolute -left-24 top-10 w-64 h-64 sm:w-80 sm:h-80 rounded-full blur-3xl bg-[#c49b5d]/20 dark:bg-[#c49b5d]/15" />
        <div className="absolute right-[-6rem] bottom-10 w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl bg-[#2f5d8c]/14 dark:bg-[#2f5d8c]/20" />
      </div>

        <ThemeToggle className="absolute right-4 top-4 z-20" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-16 text-center">
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-[#4f4438] dark:text-[#c8bbac] uppercase tracking-[0.2em] mb-6 sm:mb-8">
            <span className="h-7 w-7 rounded-full bg-[#c49b5d]/12 dark:bg-white/[0.06] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#8f5b18] dark:text-[#d5aa67]" />
            </span>
            Huddle Assistant
          </div>

          <div className="grid gap-6 md:gap-12 lg:gap-16 md:grid-cols-[1.05fr_0.95fr] items-start">
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-tight">
                  Confident replies, <span className="gradient-text">without the guesswork.</span>
                </h1>
              </div>
              <div className="flex justify-center md:justify-start">
                <a
                  href="/flow"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 text-[#071326] text-sm font-semibold shadow-lg shadow-[#4d3c2a]/20 dark:shadow-black/40 hover:brightness-105 transition-transform duration-400 hover:-translate-y-0.5"
                >
                  See the flow page
                </a>
              </div>

              {/* Compact highlights on mobile, full cards on md+ */}
              <div className="flex gap-2 overflow-x-auto pb-1 md:hidden justify-center">
                {features.map(({ title }) => (
                  <span
                    key={title}
                    className="px-3 py-2 rounded-full bg-white/80 border border-[#826f56]/20 text-xs text-[#4f4438] dark:bg-white/[0.06] dark:border-white/10 dark:text-[#e5ddd2] whitespace-nowrap shadow-sm"
                  >
                    {title}
                  </span>
                ))}
              </div>
              <div className="hidden md:grid gap-3 sm:grid-cols-2">
                {features.map(({ icon: Icon, title, copy }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-[#826f56]/15 bg-white/90 p-4 flex gap-3 items-start shadow-[0_14px_38px_rgba(77,60,42,0.10)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_24px_60px_rgba(0,0,0,0.30)] hover:-translate-y-1 transition-transform duration-500"
                  >
                    <div className="h-10 w-10 rounded-lg bg-[#c49b5d]/12 dark:bg-white/[0.06] flex items-center justify-center shadow-inner">
                      <Icon className="w-5 h-5 text-[#8f5b18] dark:text-[#d5aa67]" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-base text-[#29231c] dark:text-[#f4efe7]">{title}</p>
                      <p className="text-sm text-[#615548] dark:text-[#b4a89a]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              </div>

            <div
              className={`rounded-2xl bg-white/90 text-[#29231c] dark:bg-[#171513]/95 dark:text-[#f4efe7] p-5 sm:p-7 shadow-[0_20px_60px_rgba(77,60,42,0.14)] dark:shadow-[0_28px_70px_rgba(0,0,0,0.46)] backdrop-blur-md border order-last md:order-none transition-all duration-300 ${
                isSignup
                  ? 'border-[#c49b5d]/45 dark:border-[#c49b5d]/40'
                  : 'border-[#826f56]/15 dark:border-white/10'
              }`}
            >
              <div className="flex items-center justify-center mb-6">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#776b5d] dark:text-[#b4a89a]">
                    {isSignup ? 'Create your account' : 'Welcome back'}
                  </p>
                  <h2 className="text-xl font-display text-[#29231c] dark:text-[#f4efe7]">
                    {isSignup ? 'Get your workspace set up' : 'Sign in to continue'}
                  </h2>
                </div>
              </div>

              <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-[#4f4438] dark:text-[#d2c7ba] flex items-center gap-2 justify-center text-center">
                    <Mail className="w-4 h-4 text-[#776b5d] dark:text-[#b4a89a]" />
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#fffcf7] border-[#826f56]/20 text-[#29231c] placeholder:text-[#776b5d] dark:bg-[#0d0c0b]/70 dark:border-white/10 dark:text-[#f4efe7] dark:placeholder:text-[#8f8477] h-12 text-center"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[#4f4438] dark:text-[#d2c7ba] flex items-center gap-2 justify-center text-center">
                    <Lock className="w-4 h-4 text-[#776b5d] dark:text-[#b4a89a]" />
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#fffcf7] border-[#826f56]/20 text-[#29231c] placeholder:text-[#776b5d] dark:bg-[#0d0c0b]/70 dark:border-white/10 dark:text-[#f4efe7] dark:placeholder:text-[#8f8477] h-12 text-center"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className={`w-full bg-gradient-to-r text-[#071326] font-display text-sm h-12 rounded-xl ${
                    isSignup
                      ? 'from-cyan-400 via-teal-400 to-emerald-400 hover:brightness-105'
                      : 'from-purple-500 via-indigo-500 to-cyan-400 hover:brightness-105'
                  }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#071326]"></div>
                      {authMode === 'signin' ? 'Signing in...' : 'Creating account...'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      {authMode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                    </div>
                  )}
                </Button>
              </form>

              <div className="mt-4 text-xs text-[#776b5d] dark:text-[#b4a89a] text-center">
                {isSignup
                  ? 'We will email you a verification link to activate your account.'
                  : 'We’ll keep you signed in on this device.'}
              </div>

              <div className="mt-6 flex items-center justify-center text-sm text-[#4f4438] dark:text-[#d2c7ba]">
                <button
                  onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  className="hover:text-[#8f5b18] dark:hover:text-[#d5aa67] transition-colors underline-offset-4 font-medium"
                >
                  {authMode === 'signin'
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default LandingPage;
