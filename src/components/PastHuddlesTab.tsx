
import { useState } from 'react';
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
import { RefreshCcw, MessageSquare, Calendar, Search, Bot, ChevronDown } from 'lucide-react';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { formatDistanceToNow } from 'date-fns';
import { getCategory } from '@/utils/huddleCategorization';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { HuddlePlay } from '@/utils/huddlePlayService';

export const PastHuddlesTab = () => {
  const { huddlePlays: initialHuddlePlays, isLoading, error, refetch } = useHuddlePlays();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<HuddlePlay[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedHuddles, setExpandedHuddles] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [editableKeywords, setEditableKeywords] = useState<string[]>([]);
  // NEW: editable bigrams/trigrams state
  const [editableBigrams, setEditableBigrams] = useState<string[]>([]);
  const [editableTrigrams, setEditableTrigrams] = useState<string[]>([]);
  // NEW: local inputs to add phrases
  const [newBigram, setNewBigram] = useState("");
  const [newTrigram, setNewTrigram] = useState("");
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
      // Initialize editable phrases from analysis
      const bi = data?.common_phrases?.bigrams ?? [];
      const tri = data?.common_phrases?.trigrams ?? [];
      setEditableBigrams(bi);
      setEditableTrigrams(tri);
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

    const updatedAnalysisData = {
      ...analysisResult,
      common_topics: editableKeywords,
      // NEW: persist edited phrases
      common_phrases: {
        bigrams: editableBigrams.filter(Boolean),
        trigrams: editableTrigrams.filter(Boolean),
      },
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
      setNewBigram("");
      setNewTrigram("");
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

  const toggleHuddleExpansion = (id: string) => {
    setExpandedHuddles(prev =>
      prev.includes(id) ? prev.filter(hId => hId !== id) : [...prev, id]
    );
  };

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const isHuddleExpanded = (id: string) => expandedHuddles.includes(id);

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
                We've analyzed your past huddles and identified common topics and phrases. Review and edit them before saving to refine your personalized style profile.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          {/* Scrollable body — flex-1 ensures it fills between sticky header and sticky footer */}
          <div className="px-4 py-4 sm:p-8 overflow-y-auto flex-1 custom-scrollbar">

            {/* Editable Common Topics - chip-like inputs with better touch targets */}
            <div className="mb-8">
              <h4 className="text-gray-200 text-lg font-semibold mb-4 font-sans text-center tracking-wide">
                Common Topics
              </h4>
              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 mx-auto max-w-[820px] shadow-lg">
                <div className="flex flex-wrap gap-3 justify-center">
                  {editableKeywords.length === 0 && (
                    <p className="text-gray-500 text-sm font-sans py-2">No topics detected. Engage in more huddles to generate insights!</p>
                  )}
                  {editableKeywords.map((keyword, index) => (
                    <div
                      key={`kw-${index}`}
                      className="flex items-center gap-2 bg-[#131824] border border-[#2a3142] rounded-full px-4 py-2.5 hover:ring-1 hover:ring-[#39415a]/60 transition-all duration-200 ease-in-out"
                    >
                      <Input
                        value={keyword}
                        onChange={(e) => handleKeywordChange(index, e.target.value)}
                        className="bg-transparent border-0 focus-visible:ring-0 focus:outline-none text-gray-100 placeholder:text-gray-400 h-auto p-0 px-1 text-sm w-[8.5rem] sm:w-auto min-w-[100px]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Phrases - Bigrams */}
            <div className="mb-8">
              <h4 className="text-gray-200 text-lg font-semibold mb-4 font-sans text-center tracking-wide">
                Common Phrases (Bigrams)
              </h4>
              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 mx-auto max-w-[820px] shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <Input
                    value={newBigram}
                    onChange={(e) => setNewBigram(e.target.value)}
                    placeholder="Add new bigram (e.g. 'follow up')"
                    className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-10 text-sm w-full sm:w-auto flex-grow rounded-lg px-4"
                  />
                  <Button size="sm" className="h-10 px-6 ml-3 bg-[#5b6bfa] hover:bg-[#4e5ae6] text-white rounded-lg" onClick={addBigram}>
                    Add
                  </Button>
                </div>
                {editableBigrams.length > 0 ? (
                  <div className="flex flex-wrap gap-3 justify-center">
                    {editableBigrams.map((p, idx) => (
                      <div
                        key={`bi-edit-${idx}`}
                        className="flex items-center gap-2 bg-[#131824] border border-[#2a3142] rounded-full px-4 py-2.5 hover:ring-1 hover:ring-[#39415a]/60 transition-all duration-200 ease-in-out"
                      >
                        <Input
                          value={p}
                          onChange={(e) => handleBigramChange(idx, e.target.value)}
                          className="bg-transparent border-0 focus-visible:ring-0 focus:outline-none text-gray-100 placeholder:text-gray-400 h-auto p-0 px-1 text-sm w-[8.5rem] sm:w-auto min-w-[100px]"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto p-0 text-red-400 hover:text-red-300 text-sm"
                          onClick={() => removeBigram(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm font-sans text-center py-2">No bigrams. Add some above to personalize your style!</p>
                )}
              </div>
            </div>

            {/* Editable Phrases - Trigrams */}
            <div className="mb-8">
              <h4 className="text-gray-200 text-lg font-semibold mb-4 font-sans text-center tracking-wide">
                Common Phrases (Trigrams)
              </h4>
              <div className="bg-[#0f1115] border border-[#1f2330] rounded-2xl p-4 sm:p-6 mx-auto max-w-[820px] shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <Input
                    value={newTrigram}
                    onChange={(e) => setNewTrigram(e.target.value)}
                    placeholder="Add new trigram (e.g. 'get back soon')"
                    className="bg-[#131824] border border-[#2a3142] text-gray-100 placeholder:text-gray-400 h-10 text-sm w-full sm:w-auto flex-grow rounded-lg px-4"
                  />
                  <Button size="sm" className="h-10 px-6 ml-3 bg-[#5b6bfa] hover:bg-[#4e5ae6] text-white rounded-lg" onClick={addTrigram}>
                    Add
                  </Button>
                </div>
                {editableTrigrams.length > 0 ? (
                  <div className="flex flex-wrap gap-3 justify-center">
                    {editableTrigrams.map((p, idx) => (
                      <div
                        key={`tri-edit-${idx}`}
                        className="flex items-center gap-2 bg-[#131824] border border-[#2a3142] rounded-full px-4 py-2.5 hover:ring-1 hover:ring-[#39415a]/60 transition-all duration-200 ease-in-out"
                      >
                        <Input
                          value={p}
                          onChange={(e) => handleTrigramChange(idx, e.target.value)}
                          className="bg-transparent border-0 focus-visible:ring-0 focus:outline-none text-gray-100 placeholder:text-gray-400 h-auto p-0 px-1 text-sm w-[9.5rem] sm:w-auto min-w-[100px]"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto p-0 text-red-400 hover:text-red-300 text-sm"
                          onClick={() => removeTrigram(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm font-sans text-center py-2">No trigrams. Add some above to personalize your style!</p>
                )}
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
                  setNewBigram("");
                  setNewTrigram("");
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction className="w-full sm:w-auto px-6 py-2.5 text-base rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors" onClick={handleConfirmAnalysis}>
                Confirm & Save Style
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
            className="bg-purple-600 text-white hover:bg-purple-700 font-sans shrink-0 rounded-full shadow-sm"
            disabled={isAnalyzing}
          >
            <Bot className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'Analyze My Style'}
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
                    <motion.div
                      className="space-y-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {categorizedHuddles[category].map((huddle) => (
                        <motion.div key={huddle.id} variants={itemVariants}>
                          <Card className="bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
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
                                <p className="text-gray-800 dark:text-gray-300 text-sm font-medium mb-1 font-sans">Context:</p>
                                <p className={`text-gray-700 dark:text-gray-400 text-sm font-sans ${!isHuddleExpanded(huddle.id) && 'line-clamp-2'}`}>
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
                                <p className="text-gray-800 dark:text-gray-300 text-sm font-medium mb-1 font-sans">Your Draft:</p>
                                <p className="text-gray-800 dark:text-gray-200 text-sm font-sans line-clamp-2">
                                  {huddle.user_draft}
                                </p>
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
                      </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </div>
  );
};
