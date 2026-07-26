import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleGauge,
  Loader2,
  Quote,
  RefreshCcw,
  Save,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { useStyleProfile } from "@/hooks/useStyleProfile";
import {
  emptyStyleProfile,
  getStyleProfileSignals,
  getStyleProfileStrength,
  type StyleProfile,
} from "@/types/styleProfile";

type StyleProfileState = ReturnType<typeof useStyleProfile>;

interface ProfileStyleTabProps {
  styleProfileState: StyleProfileState;
}

interface TagEditorProps {
  label: string;
  description: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
  visibleLimit?: number;
  emptyText?: string;
}

const TagEditor = ({
  label,
  description,
  values,
  placeholder,
  onChange,
  visibleLimit = 8,
  emptyText = "Add one or two examples to get started.",
}: TagEditorProps) => {
  const [nextValue, setNextValue] = useState("");
  const [showAll, setShowAll] = useState(false);
  const visibleValues = showAll ? values : values.slice(0, visibleLimit);
  const hiddenCount = Math.max(0, values.length - visibleLimit);

  const addValue = () => {
    const value = nextValue.trim();
    if (!value) return;
    onChange(Array.from(new Set([...values, value])));
    setNextValue("");
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[#3a332c] dark:text-[#eee5da]">{label}</Label>
        <p className="mt-1 text-xs leading-relaxed text-[#776b5d] dark:text-[#a99d90]">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleValues.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#c49b5d]/25 bg-[#c49b5d]/10 px-3 py-1.5 text-xs font-medium text-[#6f4b1f] dark:border-[#c49b5d]/20 dark:bg-[#c49b5d]/10 dark:text-[#e0bb80]"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="rounded-full p-0.5 transition hover:bg-[#c49b5d]/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <p className="text-xs italic text-[#8b8074] dark:text-[#8f857a]">
            {emptyText}
          </p>
        )}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-[#776b5d] transition hover:bg-[#efe7dc] hover:text-[#29231c] dark:text-[#b4a89a] dark:hover:bg-white/[0.05] dark:hover:text-[#f4efe7]"
          >
            {showAll ? "Show fewer" : `+${hiddenCount} more`}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={nextValue}
          onChange={(event) => setNextValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className="h-10 rounded-xl border-[#826f56]/15 bg-[#fffcf7] text-[#29231c] focus-visible:ring-[#c49b5d]/40 dark:border-white/10 dark:bg-[#0d0c0b] dark:text-[#f4efe7]"
        />
        <Button
          type="button"
          variant="outline"
          onClick={addValue}
          disabled={!nextValue.trim()}
          className="h-10 rounded-xl border-[#826f56]/20 bg-transparent px-4 text-[#5f5448] dark:border-white/10 dark:text-[#d5c9bc]"
        >
          Add
        </Button>
      </div>
    </div>
  );
};

const optionClass = (active: boolean) =>
  `h-10 flex-1 rounded-xl border px-3 text-sm transition ${
    active
      ? "border-[#c49b5d] bg-[#c49b5d] text-[#071326] shadow-sm hover:bg-[#b98e54]"
      : "border-[#826f56]/15 bg-transparent text-[#685d51] hover:bg-[#efe7dc] dark:border-white/10 dark:text-[#b4a89a] dark:hover:bg-white/[0.05]"
  }`;

export const ProfileStyleTab = ({
  styleProfileState,
}: ProfileStyleTabProps) => {
  const {
    profile,
    isLoading,
    isAnalyzing,
    isSaving,
    error,
    analyzeFromReplies,
    saveProfile,
  } = styleProfileState;
  const { toast } = useToast();
  const [draft, setDraft] = useState<StyleProfile>(() =>
    profile ? profile : emptyStyleProfile(),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showLearnedDetails, setShowLearnedDetails] = useState(false);

  useEffect(() => {
    if (!profile || isDirty) return;
    setDraft(profile);
  }, [isDirty, profile]);

  const updateDraft = (update: (current: StyleProfile) => StyleProfile) => {
    setDraft((current) => update(current));
    setIsDirty(true);
  };

  const strength = useMemo(() => getStyleProfileStrength(draft), [draft]);
  const signals = useMemo(() => getStyleProfileSignals(draft), [draft]);
  const phrases = useMemo(
    () => [
      ...draft.common_phrases.bigrams,
      ...draft.common_phrases.trigrams,
    ],
    [draft.common_phrases],
  );

  const replacePhrases = (values: string[]) => {
    const bigrams = values.filter(
      (value) => value.trim().split(/\s+/).length <= 2,
    );
    const trigrams = values.filter(
      (value) => value.trim().split(/\s+/).length > 2,
    );
    updateDraft((current) => ({
      ...current,
      common_phrases: { bigrams, trigrams },
    }));
  };

  const handleAnalyze = async () => {
    try {
      const analyzed = await analyzeFromReplies();
      setDraft((current) => ({
        ...analyzed,
        formality: current.formality || analyzed.formality,
        sentiment: current.sentiment || analyzed.sentiment,
        personal_profile: {
          occupation:
            current.personal_profile.occupation ||
            analyzed.personal_profile.occupation,
          hobbies:
            current.personal_profile.hobbies ||
            analyzed.personal_profile.hobbies,
          location:
            current.personal_profile.location ||
            analyzed.personal_profile.location,
          fun_fact:
            current.personal_profile.fun_fact ||
            analyzed.personal_profile.fun_fact,
        },
      }));
      setIsDirty(true);
      toast({
        title: "Voice signals refreshed",
        description:
          "Review the updated profile, then save it for your next reply.",
      });
    } catch (analysisError) {
      toast({
        title: "Couldn’t refresh your profile",
        description:
          analysisError instanceof Error
            ? analysisError.message
            : "Create a few replies first and try again.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    try {
      await saveProfile(draft);
      setIsDirty(false);
      toast({
        title: "Reply profile active",
        description: "New replies will use these voice signals automatically.",
      });
    } catch (saveError) {
      toast({
        title: "Couldn’t save your profile",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-80 w-full max-w-5xl flex-col items-center justify-center gap-3 rounded-3xl border border-[#826f56]/15 bg-white/60 text-sm text-[#776b5d] dark:border-white/10 dark:bg-[#171513] dark:text-[#b4a89a]">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c49b5d]/15">
          <Loader2 className="h-5 w-5 animate-spin text-[#8f5b18] dark:text-[#d5aa67]" />
        </span>
        Loading your reply profile…
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8f5b18] dark:text-[#d5aa67]">
            Voice profile
          </p>
          <h2 className="font-display text-2xl leading-tight text-[#29231c] dark:text-[#f4efe7] sm:text-3xl">
            Make every reply sound more like you
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[#776b5d] dark:text-[#b4a89a]">
            Choose the tone and phrases you want Huddle to follow. Everything
            else is learned quietly from replies you keep.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleAnalyze}
            disabled={isAnalyzing || isSaving}
            className="h-11 rounded-xl border-[#826f56]/20 bg-white/60 text-[#5f5448] hover:bg-white dark:border-white/10 dark:bg-[#171513] dark:text-[#d5c9bc] dark:hover:bg-[#201d1a]"
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh learning
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving || isAnalyzing}
            className="h-11 rounded-xl bg-[#c49b5d] px-5 text-[#071326] hover:bg-[#b58a52]"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-[#b34a3a]/20 bg-[#b34a3a]/8 px-4 py-3 text-sm text-[#8f3428] dark:text-[#ff9b8d]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-[#826f56]/15 bg-white/80 shadow-[0_18px_50px_-38px_rgba(77,60,42,0.65)] dark:border-white/10 dark:bg-[#171513]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c49b5d]/16 text-[#8f5b18] dark:text-[#d5aa67]">
                <CircleGauge className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#29231c] dark:text-[#f4efe7]">
                  {strength.label} profile
                </p>
                <p className="text-xs text-[#776b5d] dark:text-[#b4a89a]">
                  {draft.huddle_count} saved replies shaping your voice
                </p>
              </div>
              <span className="ml-auto text-2xl font-semibold text-[#29231c] dark:text-[#f4efe7]">
                {strength.score}%
              </span>
            </div>
            <Progress
              value={strength.score}
              aria-label={`${strength.score}% profile strength`}
              className="h-2 bg-[#efe7dc] dark:bg-white/[0.06] [&>div]:bg-[#c49b5d]"
            />
            <p className="text-xs leading-relaxed text-[#776b5d] dark:text-[#b4a89a]">
              Profile learning uses your saved replies without making another
              paid generation call.
            </p>
          </div>

          <div className="rounded-2xl bg-[#efe7dc]/65 p-4 dark:bg-[#0d0c0b]/65">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#8f5b18] dark:text-[#d5aa67]" />
              <div>
                <p className="text-sm font-semibold text-[#29231c] dark:text-[#f4efe7]">
                  Active style
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {signals.length > 0 ? (
                    signals.map((signal) => (
                      <span
                        key={signal}
                        className="rounded-full bg-white/65 px-2.5 py-1 text-xs text-[#65594d] dark:bg-white/[0.06] dark:text-[#cfc2b4]"
                      >
                        {signal}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#776b5d] dark:text-[#b4a89a]">
                      Learn from a few saved replies to activate voice matching.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5 rounded-3xl border border-[#826f56]/15 bg-white/75 p-5 dark:border-white/10 dark:bg-[#171513] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c49b5d]/14 text-[#8f5b18] dark:text-[#d5aa67]">
              <WandSparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#29231c] dark:text-[#f4efe7]">
                How replies should feel
              </h3>
              <p className="text-xs text-[#776b5d] dark:text-[#b4a89a]">
                Pick one option from each row.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#3a332c] dark:text-[#eee5da]">
              Writing style
            </Label>
            <div className="flex gap-2">
              {[
                { value: "casual", label: "Casual" },
                { value: "balanced", label: "Natural" },
                { value: "polished", label: "Polished" },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  aria-pressed={draft.formality === value}
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      formality: value,
                    }))
                  }
                  className={optionClass(draft.formality === value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[#3a332c] dark:text-[#eee5da]">
              Overall feel
            </Label>
            <div className="flex gap-2">
              {[
                { value: "warm", label: "Warm" },
                { value: "neutral", label: "Neutral" },
                { value: "direct", label: "Direct" },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  aria-pressed={draft.sentiment === value}
                  onClick={() =>
                    updateDraft((current) => ({
                      ...current,
                      sentiment: value,
                    }))
                  }
                  className={optionClass(draft.sentiment === value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5 rounded-3xl border border-[#826f56]/15 bg-white/75 p-5 dark:border-white/10 dark:bg-[#171513] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c49b5d]/14 text-[#8f5b18] dark:text-[#d5aa67]">
              <UserRound className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#29231c] dark:text-[#f4efe7]">
                Optional details about you
              </h3>
              <p className="text-xs text-[#776b5d] dark:text-[#b4a89a]">
                Used only when the conversation actually asks about you.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["occupation", "Work", "e.g. software engineer"],
              ["location", "Location", "e.g. Melbourne"],
              ["hobbies", "Interests", "e.g. boxing, ecommerce"],
              ["fun_fact", "Useful detail", "Something worth remembering"],
            ].map(([field, label, placeholder]) => (
              <div key={field} className="space-y-2">
                <Label
                  htmlFor={`profile-${field}`}
                  className="text-[#3a332c] dark:text-[#eee5da]"
                >
                  {label}
                </Label>
                <Input
                  id={`profile-${field}`}
                  value={
                    draft.personal_profile[
                      field as keyof StyleProfile["personal_profile"]
                    ]
                  }
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      personal_profile: {
                        ...current.personal_profile,
                        [field]: event.target.value,
                      },
                    }))
                  }
                  placeholder={placeholder}
                  className="h-10 rounded-xl border-[#826f56]/15 bg-[#fffcf7] text-[#29231c] focus-visible:ring-[#c49b5d]/40 dark:border-white/10 dark:bg-[#0d0c0b] dark:text-[#f4efe7]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-3xl border border-[#826f56]/15 bg-white/75 p-5 dark:border-white/10 dark:bg-[#171513] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c49b5d]/14 text-[#8f5b18] dark:text-[#d5aa67]">
            <Quote className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-semibold text-[#29231c] dark:text-[#f4efe7]">
              Phrases that sound like you
            </h3>
            <p className="text-xs text-[#776b5d] dark:text-[#b4a89a]">
              Keep this list short and genuine. Huddle uses a phrase only when
              it fits naturally.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#f4efe7]/70 p-4 dark:bg-[#0d0c0b]/60 sm:p-5">
          <TagEditor
            label="Phrases to keep"
            description="Examples: “yeah bro”, “love that”, or “keen for a chat”. Remove anything that does not feel like you."
            values={phrases}
            placeholder="Add a phrase you use"
            onChange={(values) => replacePhrases(values.slice(0, 20))}
            visibleLimit={8}
            emptyText="Add a phrase you would naturally send."
          />
        </div>

        {Boolean(
          draft.style_fingerprint.slang_examples?.length ||
            draft.common_topics.length ||
            draft.common_sentences.length,
        ) && (
          <div className="border-t border-[#826f56]/12 pt-4 dark:border-white/[0.07]">
            <Button
              type="button"
              variant="ghost"
              aria-expanded={showLearnedDetails}
              onClick={() => setShowLearnedDetails((current) => !current)}
              className="h-10 w-full justify-between rounded-xl px-3 text-[#5f5448] hover:bg-[#efe7dc] dark:text-[#c8bcaf] dark:hover:bg-white/[0.04]"
            >
              <span className="text-sm font-medium">
                More learned details
                <span className="ml-2 text-xs font-normal text-[#8a7d70] dark:text-[#92877c]">
                  Optional
                </span>
              </span>
              {showLearnedDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showLearnedDetails && (
              <div className="mt-4 space-y-6 rounded-2xl border border-[#826f56]/12 bg-[#fffcf7] p-4 dark:border-white/[0.07] dark:bg-[#0d0c0b]/55">
                {draft.style_fingerprint.slang_examples?.length ? (
                  <div>
                    <p className="text-sm font-medium text-[#3a332c] dark:text-[#eee5da]">
                      Natural vocabulary
                    </p>
                    <p className="mt-1 text-xs text-[#776b5d] dark:text-[#a99d90]">
                      Learned automatically from replies you kept.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {draft.style_fingerprint.slang_examples
                        .slice(0, 8)
                        .map((word) => (
                          <span
                            key={word}
                            className="rounded-full bg-[#c49b5d]/10 px-2.5 py-1 text-xs text-[#6f4b1f] dark:text-[#e0bb80]"
                          >
                            {word}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : null}

                <TagEditor
                  label="Conversation topics"
                  description="Background context Huddle may use to choose familiar wording."
                  values={draft.common_topics}
                  placeholder="Add a topic"
                  visibleLimit={6}
                  onChange={(commonTopics) =>
                    updateDraft((current) => ({
                      ...current,
                      common_topics: commonTopics.slice(0, 16),
                    }))
                  }
                />

                {draft.common_sentences.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-[#3a332c] dark:text-[#eee5da]">
                      Sentence rhythm
                    </p>
                    <p className="mt-1 text-xs text-[#776b5d] dark:text-[#a99d90]">
                      Examples are used for rhythm, not copied word-for-word.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {draft.common_sentences.slice(0, 4).map((sentence) => (
                        <div
                          key={sentence}
                          className="flex items-start gap-2 rounded-xl bg-[#f4efe7] px-3 py-2.5 text-xs leading-relaxed text-[#675b4f] dark:bg-white/[0.04] dark:text-[#c5b9ac]"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#348f6a]" />
                          {sentence}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
