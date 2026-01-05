import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  MessageSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Workflow,
} from "lucide-react";

type RevealProps = {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  delay?: number;
  parallax?: boolean;
  hover?: boolean;
  className?: string;
};

const Reveal = ({
  children,
  as: Component = "div",
  delay = 0,
  parallax = false,
  hover = false,
  className = "",
}: RevealProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!parallax) return;
    const handleScroll = () => {
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const ratio = (viewport - rect.top) / (viewport + rect.height);
      const clamped = Math.min(1, Math.max(0, ratio));
      setOffset((0.5 - clamped) * 26);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [parallax]);

  const style: React.CSSProperties = {
    transitionDelay: inView ? `${delay}ms` : undefined,
    ["--parallax" as string]: parallax && inView ? `${offset}px` : "0px",
  };

  return (
    <Component
      ref={ref as React.RefObject<any>}
      className={`apple-reveal ${parallax ? "parallax" : ""} ${hover ? "apple-lift" : ""} ${
        inView ? "in-view" : ""
      } ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
};

const flow = [
  {
    title: "Capture the huddle",
    summary: "Drop a screenshot. We auto-read the screenshot.",
    icon: Sparkles,
    color: "from-cyan-500/25 via-blue-500/20 to-slate-950 border-cyan-300/40",
    notes: [
      "Assistant extracts text from screenshot",
      "Picks up on your language",
    ],
  },
  {
    title: "Draft with confidence",
    summary: "Type up an intentional message and let Huddle Play write the first pass.",
    icon: MessageSquare,
    color: "from-purple-500/25 via-indigo-500/25 to-slate-950 border-indigo-300/40",
    notes: [
      "Grounded by past huddles + your Skillset Documents",
      "Keeps voice consistent while staying concise",
    ],
  },
  {
    title: "Review & personalize",
    summary: "tweak, regenerate, or apply a warmer/cooler tone on the fly.",
    icon: Bot,
    color: "from-emerald-500/25 via-teal-500/20 to-slate-950 border-emerald-300/35",
    notes: [
      "Copy to clipboard",
      "Update toneality or regenerate from different angle",
    ],
  },
  {
    title: "Share & learn",
    summary: "Replies stay linked to the huddle so we improve with each send.",
    icon: Workflow,
    color: "from-pink-500/25 via-fuchsia-500/20 to-slate-950 border-pink-300/35",
    notes: [
      "Feedback loop tags what resonated",
      "Playbooks update for your user",
    ],
  },
];

const quickWins = [
  { label: "Time saved", value: "Quick replies", icon: Timer },
  { label: "Confidence", value: "Fewer rewrites, clearer asks", icon: ShieldCheck },
  { label: "Warmth", value: "Human-first tone by default", icon: Star },
];

const personas = ["PMs", "Support", "Successful DTM's"];

const FlowPage = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-24 top-12 w-72 h-72 rounded-full bg-purple-600/25 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 w-80 h-80 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="absolute left-10 bottom-0 w-64 h-64 rounded-full bg-emerald-400/25 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10 space-y-10">
        <Reveal as="header" className="space-y-4 text-center">
          <Reveal
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 shadow-lg shadow-cyan-900/30 text-sm font-medium text-cyan-100 inline-block"
            delay={80}
            hover
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            Huddle Play flow
          </Reveal>
          <Reveal delay={140}>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-semibold leading-tight">
              Walk Through
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto">
              Friendly, bright, and easy to follow: how a huddle becomes a helpful reply.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm">
              {personas.map((persona) => (
                <span
                  key={persona}
                  className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-100 shadow-sm"
                >
                  {persona}
                </span>
              ))}
            </div>
          </Reveal>
        </Reveal>

        <section className="grid gap-4 sm:gap-5 sm:grid-cols-3">
          {quickWins.map(({ label, value, icon: Icon }, idx) => (
            <Reveal
              key={label}
              delay={120 + idx * 100}
              hover
              className="rounded-2xl bg-slate-900/70 border border-white/10 shadow-2xl shadow-purple-900/30 p-4 sm:p-5 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-cyan-400 border border-white/20 flex items-center justify-center shadow-inner">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-wide text-slate-400 font-semibold">
                  {label}
                </p>
                <p className="text-lg font-display text-white">{value}</p>
              </div>
            </Reveal>
          ))}
        </section>

        <section className="space-y-6">
          <Reveal className="flex items-center gap-3" delay={80}>
            <div className="h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center shadow-lg shadow-cyan-900/50">
              <ArrowRight className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Flow</p>
              <p className="text-lg font-display text-white">Show this row-by-row during the call</p>
            </div>
          </Reveal>

          <div className="grid gap-5">
            {flow.map((step, idx) => (
              <Reveal
                key={step.title}
                delay={120 + idx * 200}
                parallax
                hover
                className={`relative overflow-hidden rounded-3xl border ${step.color} shadow-xl`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-80`}
                  aria-hidden
                />
                <div className="relative p-5 sm:p-7 lg:p-8 flex flex-col gap-4 sm:gap-5 backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-950/80 border border-white/30 flex items-center justify-center text-white shadow-md shadow-purple-900/50">
                        <step.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.26em] text-slate-200">
                          Step {idx + 1}
                        </p>
                        <h2 className="text-2xl font-display text-white">{step.title}</h2>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-white border border-white/20 shadow-sm">
                      <Mic className="w-4 h-4 text-cyan-200" />
                      <span className="text-sm font-medium">What to narrate</span>
                    </div>
                  </div>

                  <p className="text-base sm:text-lg text-slate-100 max-w-3xl leading-relaxed">
                    {step.summary}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {step.notes.map((note, noteIdx) => (
                      <Reveal
                        key={note}
                        delay={180 + idx * 200 + noteIdx * 80}
                        className="flex items-start gap-2 rounded-2xl bg-slate-950/60 border border-white/20 px-3 py-3 shadow-sm"
                        hover
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                        <p className="text-sm text-slate-100">{note}</p>
                      </Reveal>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Reveal
            delay={120}
            className="rounded-3xl bg-slate-900/70 border border-white/10 p-6 shadow-2xl shadow-purple-900/30 space-y-3"
          >
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              Guardrails people care about
            </div>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>• Shows sources (past huddles + docs) right under the draft.</li>
              <li>• Tone slider keeps it on-brand; no surprises in how we respond.</li>
              <li>• Never sends automatically—always a human in the loop.</li>
              <li>• Works equally well on mobile screenshots and forwarded threads.</li>
            </ul>
          </Reveal>

          <Reveal
            delay={200}
            className="rounded-3xl bg-gradient-to-br from-purple-800 via-slate-900 to-cyan-900 text-white p-6 shadow-2xl shadow-indigo-900/50 space-y-4"
            hover
          >
            <div className="flex items-center gap-2 font-semibold">
              <Bot className="w-5 h-5 text-cyan-200" />
              How to run the live demo
            </div>
            <ol className="space-y-2 text-sm text-slate-100">
              <li>1. Drop a fresh huddle screenshot to show text + name inference.</li>
              <li>2. Type a intentional response and hit Generate to reveal the reply.</li>
              <li>3. Switch tone to “warm” and regenerate to show control.</li>
              <li>4. Copy to clipboard and call out the sourced huddles/docs.</li>
            </ol>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Timer className="w-4 h-4" />
              90-second walkthrough—keep it breezy.
            </div>
          </Reveal>
        </section>

        <div className="flex justify-center pt-2 pb-6">
          <a
            href="https://huddle-reply-scribe-production.up.railway.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 text-white font-semibold shadow-lg shadow-cyan-900/50 hover:brightness-110 transition-transform duration-500 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            Open Huddle Play
          </a>
        </div>
      </div>
    </div>
  );
};

export default FlowPage;
