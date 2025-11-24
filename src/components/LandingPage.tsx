
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Sparkles, Mail, Lock, UserPlus, LogIn, CheckCircle2, ShieldCheck, Bot } from "lucide-react";

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

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
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

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="pattern-grid absolute inset-0" />
        <div className="absolute -left-24 top-10 w-64 h-64 sm:w-80 sm:h-80 rounded-full blur-3xl bg-purple-600/25" />
        <div className="absolute right-[-6rem] bottom-10 w-72 h-72 sm:w-96 sm:h-96 rounded-full blur-3xl bg-cyan-400/20" />
      </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-16 text-center">
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-300 uppercase tracking-[0.2em] mb-6 sm:mb-8">
            <span className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-200" />
            </span>
            Huddle Assistant
          </div>

          <div className="grid gap-6 md:gap-12 lg:gap-16 md:grid-cols-[1.05fr_0.95fr] items-start">
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-tight">
                  Confident replies, <span className="gradient-text">without the guesswork.</span>
                </h1>
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
                  Upload a screenshot, draft your message, get replies that stay unique.
                </p>
              </div>

              {/* Compact highlights on mobile, full cards on md+ */}
              <div className="flex gap-2 overflow-x-auto pb-1 md:hidden justify-center">
                {features.map(({ title }) => (
                  <span
                    key={title}
                    className="px-3 py-2 rounded-full bg-white/10 border border-white/10 text-xs text-slate-200 whitespace-nowrap dark:bg-white/10 dark:text-slate-200 bg-slate-100 text-slate-800 border-slate-200"
                  >
                    {title}
                  </span>
                ))}
              </div>
              <div className="hidden md:grid gap-3 sm:grid-cols-2">
                {features.map(({ icon: Icon, title, copy }) => (
                  <div
                    key={title}
                    className="glass-surface rounded-xl p-4 flex gap-3 items-start hover:-translate-y-1 transition-transform duration-500"
                  >
                    <div className="h-10 w-10 rounded-lg bg-white/10 dark:bg-white/10 bg-slate-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-cyan-600 dark:text-cyan-200" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-base text-slate-900 dark:text-white">{title}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-300 flex-wrap justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Verified accounts get a streamlined handoff to your huddles.
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-md border border-white/10 order-last md:order-none">
              <div className="flex items-center justify-center mb-6">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Get started</p>
                  <h2 className="text-xl font-display">Sign {authMode === 'signin' ? 'in' : 'up'} to continue</h2>
                </div>
              </div>

              <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 flex items-center gap-2 justify-center text-center">
                    <Mail className="w-4 h-4 text-slate-400" />
                    Work email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-900/70 border-white/10 text-white h-12 text-center"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 flex items-center gap-2 justify-center text-center">
                    <Lock className="w-4 h-4 text-slate-400" />
                    Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-900/70 border-white/10 text-white h-12 text-center"
                    required
                  />
                  <p className="text-xs text-slate-400 text-center">We’ll keep you signed in on this device.</p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 hover:brightness-110 text-white font-display text-sm h-12 rounded-xl"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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

              <div className="mt-6 flex items-center justify-center text-sm text-slate-300">
                <button
                  onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                  className="hover:text-white transition-colors underline-offset-4"
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
