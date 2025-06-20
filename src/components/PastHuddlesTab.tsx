
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

export const PastHuddlesTab = () => {
  const { huddlePlays: initialHuddlePlays, isLoading, error, refetch } = useHuddlePlays();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedHuddles, setExpandedHuddles] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [editableKeywords, setEditableKeywords] = useState<string[]>([]);
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
    }
  };

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...editableKeywords];
    newKeywords[index] = value;
    setEditableKeywords(newKeywords);
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Style Keywords</AlertDialogTitle>
            <AlertDialogDescription>
              We've analyzed your past huddles and identified these common keywords. Feel free to edit them before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
           {editableKeywords.map((keyword, index) => (
             <Input
               key={index}
               value={keyword}
               onChange={(e) => handleKeywordChange(index, e.target.value)}
               className="bg-gray-700 border-gray-600 text-white"
             />
           ))}
         </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
             setAnalysisResult(null);
             setEditableKeywords([]);
           }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAnalysis}>Confirm & Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h3 className="text-white text-xl font-bold font-sans shrink-0">
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
              className="bg-gray-800 border-gray-700 text-white pl-10 w-full rounded-full focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <Button
            onClick={handleAnalyzeStyle}
            variant="ghost"
            size="sm"
            className="bg-purple-600 text-white hover:bg-purple-700 font-sans shrink-0 rounded-full"
            disabled={isAnalyzing}
          >
            <Bot className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'Analyze My Style'}
          </Button>
        </div>
      </div>

      <div className="space-y-3 pb-4">
        {sortedCategories.map((category) => (
          <Card key={category} className="bg-gray-800/50 border-gray-700/50 overflow-hidden rounded-lg">
            <div
              className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-700/30 transition-colors"
              onClick={() => toggleCategoryExpansion(category)}
            >
              <h4 className="text-white font-semibold text-md">
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
                          <Card className="bg-gray-800/90 rounded-lg border border-gray-700">
                            <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-400 text-sm font-sans">
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
                                <p className="text-gray-300 text-sm font-medium mb-1 font-sans">Context:</p>
                                <p className={`text-gray-400 text-sm font-sans ${!isHuddleExpanded(huddle.id) && 'line-clamp-2'}`}>
                                  {huddle.screenshot_text}
                                </p>
                                {huddle.screenshot_text && huddle.screenshot_text.length > 150 && (
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto text-xs text-blue-400 hover:no-underline"
                                    onClick={() => toggleHuddleExpansion(huddle.id)}
                                  >
                                    {isHuddleExpanded(huddle.id) ? 'Show less' : 'Expand context'}
                                  </Button>
                                )}
                              </div>

                              <div>
                                <p className="text-gray-300 text-sm font-medium mb-1 font-sans">Your Draft:</p>
                                <p className="text-gray-200 text-sm font-sans line-clamp-2">
                                  {huddle.user_draft}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-300 text-sm font-medium mb-1 font-sans">
                                  {huddle.final_reply ? 'Final Reply:' : 'Generated Reply:'}
                                </p>
                                <div className="bg-gray-900 p-3 rounded-lg border border-gray-700">
                                  <p className="text-white text-sm font-sans">
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
