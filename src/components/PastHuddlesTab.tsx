
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCcw, MessageSquare, Calendar, Search, ChevronDown, Sparkles, X, Loader2 } from 'lucide-react';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { formatDistanceToNow } from 'date-fns';
import { getCategory } from '@/utils/huddleCategorization';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { HuddlePlay } from '@/utils/huddlePlayService';

type Fingerprint = Record<string, unknown> | null;

type StyleFingerprintDetails = {
  emoji_rate_per_message?: number;
  emoji_message_share?: number;
  exclamation_per_sentence?: number;
  question_per_sentence?: number;
  uppercase_word_ratio?: number;
  typical_word_count?: number;
  typical_char_count?: number;
  slang_examples?: string[];
  greetings?: string[];
  closings?: string[];
};

type AnalysisResult = {
  huddle_count?: number;
  common_topics?: string[];
  common_phrases?: { bigrams?: string[]; trigrams?: string[] };
  common_sentences?: string[];
  personal_profile?: {
    occupation?: string;
    hobbies?: string;
    location?: string;
    fun_fact?: string;
  };
  style_fingerprint?: StyleFingerprintDetails;
};

const capitalizeWord = (input?: string) => {
  if (!input) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
};

const diffList = (initial: string[], current: string[]) => {
  const initialClean = initial.map((v) => v.trim()).filter(Boolean);
  const currentClean = current.map((v) => v.trim()).filter(Boolean);
  return {
    added: currentClean.filter((item) => !initialClean.includes(item)),
    removed: initialClean.filter((item) => !currentClean.includes(item)),
    kept: currentClean.filter((item) => initialClean.includes(item)),
  };
};

const pickFromList = (list: string[] | undefined, seed: number, fallback = '') => {
  if (!list || list.length === 0) return fallback;
  const index = Math.abs(seed) % list.length;
  return list[index];
};

const buildStylePreview = ({
  topics,
  bigrams,
  trigrams,
  fingerprint,
  seed,
}: {
  topics: string[];
  bigrams: string[];
  trigrams: string[];
  fingerprint?: StyleFingerprintDetails;
  seed: number;
}) => {
  const safeSeed = seed || Date.now();
  const topic = pickFromList(topics, safeSeed, 'your update');
  const phrase = pickFromList([...trigrams, ...bigrams], safeSeed + 1, '');
  const greeting = capitalizeWord(pickFromList(fingerprint?.greetings, safeSeed + 2, ''));
  const closing = capitalizeWord(pickFromList(fingerprint?.closings, safeSeed + 3, ''));
  const emojiLikely =
    (fingerprint?.emoji_rate_per_message ?? 0) > 0.2 ||
    (fingerprint?.emoji_message_share ?? 0) > 0.3;
  const emoji = emojiLikely ? ' 😊' : '';
  const punctuationLean = (fingerprint?.exclamation_per_sentence ?? 0) > 0.6 ? '!' : '.';
  const cadence = phrase ? `Quick note on ${topic}: ${phrase}${punctuationLean}` : `Quick note on ${topic}${punctuationLean}`;
  const closingLine = closing ? ` ${closing}.` : '';
  const greetLine = greeting ? `${greeting}, ` : '';
  return `${greetLine}${cadence}${emoji}${closingLine}`.trim();
};

const formatFingerprintValue = (
  analysisResult: Fingerprint,
  primary: string,
  secondary?: string
): string => {
  const fp = (analysisResult as { style_fingerprint?: Record<string, unknown> })?.style_fingerprint || {};
  if (!fp) return '—';

  if (primary === 'emoji_rate_per_message') {
    const rate = fp['emoji_rate_per_message'] as number | undefined;
    const share = fp['emoji_message_share'] as number | undefined;
    if (rate === undefined && share === undefined) return '—';
    const sharePct = share !== undefined ? `${Math.round(share * 100)}% msgs` : '';
    return `${rate ?? '—'}/msg ${sharePct ? `• ${sharePct}` : ''}`;
  }

  if (primary === 'exclamation_per_sentence') {
    const ex = fp['exclamation_per_sentence'] as number | undefined;
    const q = fp['question_per_sentence'] as number | undefined;
    if (ex === undefined && q === undefined) return '—';
    return `! ${ex ?? '—'}/sent • ? ${q ?? '—'}/sent`;
  }

  if (primary === 'uppercase_word_ratio') {
    const ratio = fp['uppercase_word_ratio'] as number | undefined;
    return ratio !== undefined ? `${Math.round(ratio * 100)}% of words` : '—';
  }

  if (primary === 'typical_word_count') {
    const words = fp['typical_word_count'] as number | undefined;
    const chars = fp['typical_char_count'] as number | undefined;
    if (words === undefined && chars === undefined) return '—';
    return `${words ?? '—'} words • ${chars ?? '—'} chars`;
  }

  if (secondary) {
    const primaryVal = fp[primary] as number | undefined;
    const secondaryVal = fp[secondary] as number | undefined;
    if (primaryVal === undefined && secondaryVal === undefined) return '—';
    return `${primaryVal ?? '—'} • ${secondaryVal ?? '—'}`;
  }

  const val = fp[primary] as string | number | undefined;
  if (typeof val === 'number') return val.toFixed(2);
  if (val) return String(val);
  return '—';
};

const formatFingerprintList = (analysisResult: Fingerprint, key: string): string => {
  const fp = (analysisResult as { style_fingerprint?: Record<string, unknown> })?.style_fingerprint || {};
  const list = fp?.[key] as string[] | undefined;
  if (!list || list.length === 0) return '—';
  return list.join(', ');
};

const FingerprintRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-2 rounded-xl bg-[#111522] border border-[#1f2330] px-3 py-2">
    <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
    <span className="text-gray-100 text-sm">{value}</span>
  </div>
);

const ChipEditable = ({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (val: string) => void;
  onRemove: () => void;
}) => (
  <div className="flex items-center gap-2 bg-[#131824] border border-[#2a3142] rounded-full px-4 py-2.5 hover:ring-1 hover:ring-[#39415a]/60 transition-all duration-200 ease-in-out shadow-sm">
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-0 focus-visible:ring-0 focus:outline-none text-gray-100 placeholder:text-gray-400 h-auto p-0 px-1 text-sm w-[8.5rem] sm:w-auto min-w-[110px]"
    />
    <Button
      size="sm"
      variant="ghost"
      className="h-auto p-0 text-gray-400 hover:text-gray-200 text-sm"
      onClick={onRemove}
    >
      <X className="w-4 h-4" />
    </Button>
  </div>
);

// Simple virtual windowing hook to avoid rendering all rows at once.
const useVirtualWindow = (count: number, itemHeight = 320, overscan = 3) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const measure = () => setViewportHeight(containerRef.current?.clientHeight || 0);
    measure();

    const resizeObserver = new ResizeObserver(measure);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    count - 1,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
  );

  return {
    containerRef,
    onScroll,
    startIndex,
    endIndex,
    offsetTop: startIndex * itemHeight,
    totalHeight: count * itemHeight,
  };
};

type VirtualizedHuddleListProps = {
  huddles: HuddlePlay[];
  isHuddleExpanded: (id: string) => boolean;
  toggleHuddleExpansion: (id: string) => void | Promise<void>;
  isDraftExpanded: (id: string) => boolean;
  toggleDraftExpansion: (id: string) => void | Promise<void>;
};

const VirtualizedHuddleList = ({
  huddles,
  isHuddleExpanded,
  toggleHuddleExpansion,
  isDraftExpanded,
  toggleDraftExpansion,
}: VirtualizedHuddleListProps) => {
  if (!huddles.length) return null;

  const itemHeightEstimate = 320; // Approx height of one huddle card; adjust if layout changes.
  const { containerRef, onScroll, startIndex, endIndex, offsetTop, totalHeight } =
    useVirtualWindow(huddles.length, itemHeightEstimate);

  const visibleHuddles = huddles.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar"
    >
      <div style={{ height: totalHeight || 'auto' }} className="relative">
        <div style={{ transform: `translateY(${offsetTop}px)` }} className="space-y-4">
          {visibleHuddles.map((huddle) => (
            <Card
              key={huddle.id}
              className="bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400 text-sm font-sans">
                      {formatDistanceToNow(new Date(huddle.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {huddle.selected_tone && huddle.selected_tone !== 'none' && (
                      <Badge variant="secondary" className="font-sans">
                        {huddle.selected_tone}
                      </Badge>
                    )}
                    {huddle.final_reply && (
                      <Badge variant="outline" className="text-green-400 border-green-400 font-sans">
                        Tone Adjusted
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-gray-800 dark:text-gray-300 text-sm font-medium mb-1 font-sans">
                      Context:
                    </p>
                    <p
                      className={`text-gray-700 dark:text-gray-400 text-sm font-sans ${
                        !isHuddleExpanded(huddle.id) && 'line-clamp-2'
                      }`}
                    >
                      {huddle.screenshot_text}
                    </p>
                    {huddle.screenshot_text && huddle.screenshot_text.length > 150 && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-blue-600 dark:text-blue-400 hover:no-underline"
                        onClick={() => toggleHuddleExpansion(huddle.id)}
                      >
                        {isHuddleExpanded(huddle.id) ? 'Show less' : 'Expand context'}
                      </Button>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-800 dark:text-gray-300 text-sm font-medium mb-1 font-sans">
                      Your Draft:
                    </p>
                    <p
                      className={`text-gray-800 dark:text-gray-200 text-sm font-sans ${
                        !isDraftExpanded(huddle.id) && 'line-clamp-2'
                      }`}
                    >
                      {huddle.user_draft}
                    </p>
                    {huddle.user_draft && huddle.user_draft.length > 120 && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-blue-600 dark:text-blue-400 hover:no-underline"
                        onClick={() => toggleDraftExpansion(huddle.id)}
                      >
                        {isDraftExpanded(huddle.id) ? 'Show less' : 'Expand draft'}
                      </Button>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-800 dark:text-gray-300 text-sm font-medium mb-1 font-sans">
                      {huddle.final_reply ? 'Final Reply:' : 'Generated Reply:'}
                    </p>
                    <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-gray-900 dark:text-white text-sm font-sans">
                        {huddle.final_reply || huddle.generated_reply}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PastHuddlesTab = () => {
  const { huddlePlays: initialHuddlePlays, isLoading, error, refetch, hasMore, loadMore, isLoadingMore, ensureHuddleDetail } = useHuddlePlays({ paginated: true, light: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<HuddlePlay[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedHuddles, setExpandedHuddles] = useState<string[]>([]);
  const [expandedDrafts, setExpandedDrafts] = useState<Record<string, boolean>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [editableKeywords, setEditableKeywords] = useState<string[]>([]);
  const [initialKeywords, setInitialKeywords] = useState<string[]>([]);
  // NEW: editable bigrams/trigrams state
  const [editableBigrams, setEditableBigrams] = useState<string[]>([]);
  const [editableTrigrams, setEditableTrigrams] = useState<string[]>([]);
  const [initialBigrams, setInitialBigrams] = useState<string[]>([]);
  const [initialTrigrams, setInitialTrigrams] = useState<string[]>([]);
  // NEW: local inputs to add phrases
  const [newBigram, setNewBigram] = useState("");
  const [newTrigram, setNewTrigram] = useState("");
  // NEW: personal profile fields
  const [personalProfile, setPersonalProfile] = useState<{ occupation?: string; hobbies?: string; location?: string; fun_fact?: string }>({});
  const [initialPersonalProfile, setInitialPersonalProfile] = useState<{ occupation?: string; hobbies?: string; location?: string; fun_fact?: string }>({});
  const [previewSeed, setPreviewSeed] = useState<number>(Date.now());
  const [isConfirmingAnalysis, setIsConfirmingAnalysis] = useState(false);
  const { toast } = useToast();

  const handleAnalyzeStyle = async () => {
    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: { action: 'analyzeStyle', userId: session.user.id },
      });

      if (error) throw error;

      setAnalysisResult(data);
      setEditableKeywords(data.common_topics || []);
      setInitialKeywords(data.common_topics || []);
      // Initialize editable phrases from analysis
      const bi = data?.common_phrases?.bigrams ?? [];
      const tri = data?.common_phrases?.trigrams ?? [];
      setEditableBigrams(bi);
      setEditableTrigrams(tri);
      setInitialBigrams(bi);
      setInitialTrigrams(tri);
      const personal = data?.personal_profile || {};
      setPersonalProfile(personal);
      setInitialPersonalProfile(personal);
      setPreviewSeed(Date.now());
      setIsConfirmingAnalysis(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze style';
      toast({
        title: 'Analysis Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmAnalysis = async () => {
    if (!analysisResult) return;
    if (!hasMinimumData) {
      toast({
        title: 'Add a bit more signal',
        description: 'Add at least 3 topics or 2 phrases before saving your style.',
        variant: 'destructive',
      });
      return;
    }

    const updatedAnalysisData = {
      ...analysisResult,
      common_topics: topicsClean,
      // NEW: persist edited phrases
      common_phrases: {
        bigrams: bigramsClean,
        trigrams: trigramsClean,
      },
      personal_profile: personalProfile,
    };

    setIsAnalyzing(true); // Reuse the analyzing state for the save operation
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'confirmAndSaveStyle',
          userId: session.user.id,
          analysisData: updatedAnalysisData,
        },
      });

      if (error) throw error;

      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${data.huddle_count} huddles. Your style profile has been updated.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save style';
      toast({
        title: 'Save Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      setIsConfirmingAnalysis(false);
      setAnalysisResult(null);
      setEditableKeywords([]);
      setEditableBigrams([]);
      setEditableTrigrams([]);
      setInitialKeywords([]);
      setInitialBigrams([]);
      setInitialTrigrams([]);
      setNewBigram("");
      setNewTrigram("");
      setPreviewSeed(Date.now());
    }
  };

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...editableKeywords];
    newKeywords[index] = value;
    setEditableKeywords(newKeywords);
  };

  // NEW: phrase editing handlers
  const handleBigramChange = (index: number, value: string) => {
    const next = [...editableBigrams];
    next[index] = value;
    setEditableBigrams(next);
  };

  const handleTrigramChange = (index: number, value: string) => {
    const next = [...editableTrigrams];
    next[index] = value;
    setEditableTrigrams(next);
  };

  const removeBigram = (index: number) => {
    const next = editableBigrams.filter((_, i) => i !== index);
    setEditableBigrams(next);
  };

  const removeTrigram = (index: number) => {
    const next = editableTrigrams.filter((_, i) => i !== index);
    setEditableTrigrams(next);
  };

  const addBigram = () => {
    const v = newBigram.trim();
    if (!v) return;
    setEditableBigrams((prev) => Array.from(new Set([...prev, v])));
    setNewBigram("");
  };

  const addTrigram = () => {
    const v = newTrigram.trim();
    if (!v) return;
    setEditableTrigrams((prev) => Array.from(new Set([...prev, v])));
    setNewTrigram("");
  };

  const resetEditsToDetected = () => {
    setEditableKeywords(initialKeywords);
    setEditableBigrams(initialBigrams);
    setEditableTrigrams(initialTrigrams);
    setNewBigram("");
    setNewTrigram("");
    setPreviewSeed(Date.now());
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('search-past-huddles', {
        body: { query: searchTerm, userId: session.user.id },
      });

      if (error) throw error;

      setSearchResults(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search';
      toast({
        title: 'Search Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleHuddleExpansion = async (id: string) => {
    setExpandedHuddles(prev =>
      prev.includes(id) ? prev.filter(hId => hId !== id) : [...prev, id]
    );
    // Hydrate full text on first open if we only have a preview
    const target = (searchResults !== null ? searchResults : initialHuddlePlays).find(
      (h) => h.id === id
    );
    if (target?.__preview) {
      await ensureHuddleDetail(id);
    }
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const isHuddleExpanded = (id: string) => expandedHuddles.includes(id);
  const isDraftExpanded = (id: string) => Boolean(expandedDrafts[id]);
  const toggleDraftExpansion = (id: string) =>
    setExpandedDrafts((prev) => ({ ...prev, [id]: !prev[id] }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
      },
    },
  };

  const SkeletonCard = () => (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const analysisData = (analysisResult || {}) as AnalysisResult;
  const topicsClean = editableKeywords.map((v) => v.trim()).filter(Boolean);
  const bigramsClean = editableBigrams.map((v) => v.trim()).filter(Boolean);
  const trigramsClean = editableTrigrams.map((v) => v.trim()).filter(Boolean);
  const sentences = analysisData.common_sentences || [];
  const phraseTotal = bigramsClean.length + trigramsClean.length;

  const topicDiff = useMemo(
    () => diffList(initialKeywords, editableKeywords),
    [editableKeywords, initialKeywords]
  );
  const phraseDiff = useMemo(
    () => diffList([...initialBigrams, ...initialTrigrams], [...editableBigrams, ...editableTrigrams]),
    [editableBigrams, editableTrigrams, initialBigrams, initialTrigrams]
  );
  const personalHasChanges = useMemo(() => {
    return (
      (personalProfile.occupation || '') !== (initialPersonalProfile.occupation || '') ||
      (personalProfile.hobbies || '') !== (initialPersonalProfile.hobbies || '') ||
      (personalProfile.location || '') !== (initialPersonalProfile.location || '') ||
      (personalProfile.fun_fact || '') !== (initialPersonalProfile.fun_fact || '')
    );
  }, [personalProfile, initialPersonalProfile]);

  const hasMinimumData = topicsClean.length >= 3 || phraseTotal >= 2;
  const readinessLabel = hasMinimumData
    ? 'Ready to apply'
    : 'Add at least 3 topics or 2 phrases to strengthen your profile';
  const previewText = useMemo(
    () =>
      buildStylePreview({
        topics: topicsClean,
        bigrams: bigramsClean,
        trigrams: trigramsClean,
        fingerprint: analysisData.style_fingerprint,
        seed: previewSeed,
      }),
    [analysisData.style_fingerprint, bigramsClean, previewSeed, topicsClean, trigramsClean]
  );
  const addedCount = topicDiff.added.length + phraseDiff.added.length;
  const removedCount = topicDiff.removed.length + phraseDiff.removed.length;

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <p className="text-red-400 mb-4 font-sans">Error loading past huddles: {error}</p>
          <Button onClick={refetch} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (initialHuddlePlays.length === 0 && !searchResults) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-white text-lg font-medium mb-2 font-sans">No Past Huddles Yet</h3>
          <p className="text-gray-400 font-sans">
            Start creating huddle plays to build your conversation history and improve future suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const huddlesToDisplay = searchResults !== null ? searchResults : initialHuddlePlays;

  const filteredHuddles = huddlesToDisplay.filter(huddle => {
    if (!searchTerm.trim() || searchResults !== null) return true; // If searching, backend handles filtering
    const searchTermLower = searchTerm.toLowerCase();
    return (
      huddle.screenshot_text?.toLowerCase().includes(searchTermLower) ||
      huddle.user_draft?.toLowerCase().includes(searchTermLower) ||
      huddle.generated_reply?.toLowerCase().includes(searchTermLower) ||
      huddle.final_reply?.toLowerCase().includes(searchTermLower)
    );
  });

  const categorizedHuddles = filteredHuddles.reduce((acc, huddle) => {
    const category = getCategory(huddle);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(huddle);
    return acc;
  }, {} as Record<string, typeof initialHuddlePlays>);

  const categoryOrder = [
    "💼 What's the business?",
    '🤔 Is it like...?',
    '💰 How do you make money?',
    '👥 Who are your mentors?',
    '🤝 How do I get involved?',
    '⚠️ Is it a pyramid scheme?',
    '💄 Product-related questions',
    '💬 General',
  ];

  const sortedCategories = Object.keys(categorizedHuddles).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="space-y-4">
      <AlertDialog open={isConfirmingAnalysis} onOpenChange={setIsConfirmingAnalysis}>
        {/* Mobile-safe dialog: use dynamic viewport units (dvh) to avoid iOS/Android 100vh issues. */}
        <AlertDialogContent className="p-0 w-[96vw] max-w-[860px] md:max-w-[900px] h-[92dvh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl border border-gray-700 bg-gray-900">
          {/* Sticky header (visible at all times on mobile) */}
          <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-4 sm:px-8 sm:py-6">
            <AlertDialogHeader className="p-0 m-0">
              <AlertDialogTitle className="text-xl sm:text-2xl font-bold text-white">Confirm Your Style Profile</AlertDialogTitle>
              <AlertDialogDescription className="text-sm sm:text-base text-gray-400 mt-1">
                We use this profile to draft replies that sound like you. Review what is changing, preview it, then apply.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          {/* Scrollable body — flex-1 ensures it fills between sticky header and sticky footer */}
          <div className="px-4 py-4 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#5b6bfa]/15 via-[#9c6bfa]/15 to-[#5b6bfa]/10 border border-[#1f2330] px-4 py-4 sm:px-6 sm:py-5 shadow-lg">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-gray-300 font-semibold">Review your style</p>
                    <p className="text-white text-lg font-semibold">We will apply these signals to every draft. Adjust or reset before saving.</p>
                  </div>
                  <div className="flex gap-3 text-sm text-gray-100 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                      {topicsClean.length || 0} topics
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                      {analysisData.huddle_count ?? '—'} drafts scanned
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                      {phraseTotal} phrases
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                      {sentences.length} sentences
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-300 font-semibold">Why it matters</p>
                    <p className="text-sm text-gray-100 mt-1">We use this profile to keep replies sounding like you.</p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-300 font-semibold">Detected signals</p>
                    <p className="text-sm text-white mt-1">{analysisData.huddle_count ?? '—'} drafts • {topicsClean.length} topics • {phraseTotal} phrases</p>
                    <p className="text-xs text-gray-200 mt-1">Changes: +{addedCount} / -{removedCount}</p>
                  </div>
                  <div className={`${hasMinimumData ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-amber-500/10 border-amber-500/30'} rounded-xl p-3 border`}>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-gray-200 font-semibold">Readiness</p>
                    <p className={`${hasMinimumData ? 'text-emerald-100' : 'text-amber-100'} text-sm font-semibold mt-1`}>{readinessLabel}</p>
                    <p className="text-xs text-gray-100 mt-1">Use preview below, then save with one tap.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 mb-6">
              <div className="space-y-6">
                <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-gray-200 text-lg font-semibold font-sans">About you</h4>
                      <p className="text-sm text-gray-400">We’ll weave this into replies when someone asks about you.</p>
                    </div>
                    {personalHasChanges && (
                      <span className="text-xs text-amber-300">Edited</span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      value={personalProfile.occupation || ''}
                      onChange={(e) => setPersonalProfile((p) => ({ ...p, occupation: e.target.value }))}
                      placeholder="Occupation (e.g. Product manager at Acme)"
                      className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-10 text-sm rounded-lg px-3"
                    />
                    <Input
                      value={personalProfile.hobbies || ''}
                      onChange={(e) => setPersonalProfile((p) => ({ ...p, hobbies: e.target.value }))}
                      placeholder="Hobbies (e.g. climbing, cooking, guitars)"
                      className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-10 text-sm rounded-lg px-3"
                    />
                    <Input
                      value={personalProfile.location || ''}
                      onChange={(e) => setPersonalProfile((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Location/timezone (e.g. NYC, EST)"
                      className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-10 text-sm rounded-lg px-3"
                    />
                    <Input
                      value={personalProfile.fun_fact || ''}
                      onChange={(e) => setPersonalProfile((p) => ({ ...p, fun_fact: e.target.value }))}
                      placeholder="Fun fact (optional)"
                      className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-10 text-sm rounded-lg px-3"
                    />
                  </div>
                </div>

                <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                  <h4 className="text-gray-200 text-lg font-semibold font-sans">Common Words</h4>
                  <span className="text-xs text-gray-500">Tap to edit</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {editableKeywords.length === 0 && (
                    <p className="text-gray-500 text-sm font-sans py-2">No topics detected. Engage in more huddles to generate insights!</p>
                  )}
                  {editableKeywords.map((keyword, index) => (
                    <div
                      key={`kw-${index}`}
                      className="flex items-center gap-2 bg-[#131824] border border-[#2a3142] rounded-full px-4 py-2.5 hover:ring-1 hover:ring-[#39415a]/60 transition-all duration-200 ease-in-out shadow-sm"
                    >
                      <Input
                        value={keyword}
                        onChange={(e) => handleKeywordChange(index, e.target.value)}
                        className="bg-transparent border-0 focus-visible:ring-0 focus:outline-none text-gray-100 placeholder:text-gray-400 h-auto p-0 px-1 text-sm w-[8.5rem] sm:w-auto min-w-[110px]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-gray-200 text-lg font-semibold font-sans">Common Phrases (Bigrams)</h4>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newBigram}
                      onChange={(e) => setNewBigram(e.target.value)}
                      placeholder="Add bigram (e.g. 'follow up')"
                      className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-9 text-sm w-full sm:w-auto flex-grow rounded-lg px-3"
                    />
                    <Button size="sm" className="h-9 px-4 bg-[#5b6bfa] hover:bg-[#4e5ae6] text-white rounded-lg" onClick={addBigram}>
                      Add
                    </Button>
                  </div>
                </div>
                {editableBigrams.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {editableBigrams.map((p, idx) => (
                      <ChipEditable key={`bi-edit-${idx}`} value={p} onChange={(v) => handleBigramChange(idx, v)} onRemove={() => removeBigram(idx)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm font-sans text-center py-2">No bigrams. Add some above to personalize your style!</p>
                )}
              </div>

              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-gray-200 text-lg font-semibold font-sans">Common Phrases (Trigrams)</h4>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newTrigram}
                      onChange={(e) => setNewTrigram(e.target.value)}
                      placeholder="Add trigram (e.g. 'get back soon')"
                      className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-9 text-sm w-full sm:w-auto flex-grow rounded-lg px-3"
                    />
                    <Button size="sm" className="h-9 px-4 bg-[#5b6bfa] hover:bg-[#4e5ae6] text-white rounded-lg" onClick={addTrigram}>
                      Add
                    </Button>
                  </div>
                </div>
                {editableTrigrams.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {editableTrigrams.map((p, idx) => (
                      <ChipEditable key={`tri-edit-${idx}`} value={p} onChange={(v) => handleTrigramChange(idx, v)} onRemove={() => removeTrigram(idx)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm font-sans text-center py-2">No trigrams. Add some above to personalize your style!</p>
                )}
              </div>

              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#9c6bfa]" />
                  <h4 className="text-gray-200 text-lg font-semibold font-sans">Common Sentences</h4>
                </div>
                {sentences.length > 0 ? (
                  <div className="space-y-2 text-sm text-gray-200">
                    {sentences.map((s, idx) => (
                      <div key={`sentence-${idx}`} className="rounded-xl bg-[#131824] border border-[#2a3142] px-3 py-2">
                        {s}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm font-sans text-center py-2">No recurring sentences detected yet.</p>
                )}
              </div>

              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#9c6bfa]" />
                  <h4 className="text-gray-200 text-lg font-semibold font-sans">Cadence & tone</h4>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-300">
                  <FingerprintRow label="Emoji cadence" value={formatFingerprintValue(analysisResult, 'emoji_rate_per_message', 'emoji_message_share')} />
                  <FingerprintRow label="Punctuation lean" value={formatFingerprintValue(analysisResult, 'exclamation_per_sentence', 'question_per_sentence')} />
                  <FingerprintRow label="Capitalization" value={formatFingerprintValue(analysisResult, 'uppercase_word_ratio')} />
                  <FingerprintRow label="Typical length" value={formatFingerprintValue(analysisResult, 'typical_word_count', 'typical_char_count')} />
                  <FingerprintRow label="Greetings" value={formatFingerprintList(analysisResult, 'greetings')} />
                  <FingerprintRow label="Closings" value={formatFingerprintList(analysisResult, 'closings')} />
                  <FingerprintRow label="Slang" value={formatFingerprintList(analysisResult, 'slang_examples')} />
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Fixed bottom action bar (sticky) */}
          <div className="sticky bottom-0 z-10 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 sm:px-8 py-4">
            <AlertDialogFooter className="p-0 m-0 gap-3 flex w-full justify-end">
              <AlertDialogCancel
                className="w-full sm:w-auto px-6 py-2.5 text-base rounded-lg border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                onClick={() => {
                  setAnalysisResult(null);
                  setEditableKeywords([]);
                  setEditableBigrams([]);
                  setEditableTrigrams([]);
                  setInitialKeywords([]);
                  setInitialBigrams([]);
                  setInitialTrigrams([]);
                  setNewBigram("");
                  setNewTrigram("");
                  setPreviewSeed(Date.now());
                  setIsConfirmingAnalysis(false);
                  setPersonalProfile(initialPersonalProfile);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="w-full sm:w-auto px-6 py-2.5 text-base rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleConfirmAnalysis}
                disabled={isAnalyzing || !hasMinimumData}
              >
                {hasMinimumData ? 'Use this style' : 'Add more signals to save'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h3 className="text-slate-900 dark:text-white text-xl font-bold font-sans shrink-0">
          Past Huddles ({filteredHuddles.length})
        </h3>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search huddles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white pl-10 pr-10 w-full rounded-full focus:ring-2 focus:ring-purple-500 shadow-sm"
            />
            {searchTerm && (
              <button
                aria-label="Clear search"
                onClick={() => {
                  setSearchTerm('');
                  setSearchResults(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            onClick={handleAnalyzeStyle}
            variant="ghost"
            size="sm"
            className="bg-purple-600 text-white hover:bg-purple-700 font-sans shrink-0 rounded-full shadow-sm px-4"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Refresh my fingerprint
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3 pb-4">
        {sortedCategories.map((category) => (
          <Card key={category} className="bg-white/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 overflow-hidden rounded-lg shadow-sm dark:shadow-none">
            <div
              className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
              onClick={() => toggleCategoryExpansion(category)}
            >
              <h4 className="text-slate-900 dark:text-white font-semibold text-md">
                {category} ({categorizedHuddles[category].length})
              </h4>
              <motion.div
                animate={{ rotate: expandedCategories.includes(category) ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </motion.div>
            </div>
            <AnimatePresence>
              {expandedCategories.includes(category) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <CardContent className="p-4 pt-0">
                    <VirtualizedHuddleList
                      huddles={categorizedHuddles[category]}
                      isHuddleExpanded={isHuddleExpanded}
                      toggleHuddleExpansion={toggleHuddleExpansion}
                      isDraftExpanded={isDraftExpanded}
                      toggleDraftExpansion={toggleDraftExpansion}
                    />
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
        {hasMore && searchResults === null && (
          <div className="flex justify-center pt-1">
            <Button
              onClick={loadMore}
              disabled={isLoadingMore}
              variant="outline"
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading more
                </>
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
