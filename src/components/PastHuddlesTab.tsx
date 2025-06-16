
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RefreshCcw, MessageSquare, Calendar, Search } from 'lucide-react';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { formatDistanceToNow } from 'date-fns';
import { getCategory } from '@/utils/huddleCategorization';

export const PastHuddlesTab = () => {
  const { huddlePlays, isLoading, error, refetch } = useHuddlePlays();
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 text-purple-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
          <span className="font-sans">Loading past huddles...</span>
        </div>
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

  if (huddlePlays.length === 0) {
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

  const filteredHuddles = huddlePlays.filter(huddle => {
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
  }, {} as Record<string, typeof huddlePlays>);

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
      <div className="flex justify-between items-center gap-4">
        <h3 className="text-white text-lg font-medium font-sans">
          Past Huddles ({filteredHuddles.length})
        </h3>
        <div className="flex-grow max-w-xs relative">
          <Input
            type="text"
            placeholder="Filter huddles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border-gray-600 text-white pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        <Button
          onClick={refetch}
          variant="outline"
          size="sm"
          className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4 pb-4">
        <Accordion type="multiple" className="w-full">
          {sortedCategories.map((category) => (
            <AccordionItem value={category} key={category}>
              <AccordionTrigger className="text-white hover:no-underline">
                {category} ({categorizedHuddles[category].length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {categorizedHuddles[category].map((huddle) => (
                    <Card key={huddle.id} className="bg-gray-800 border-gray-700">
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

                        <div className="space-y-3">
                          <div>
                            <p className="text-gray-300 text-sm font-medium mb-1 font-sans">Context:</p>
                            <p className="text-gray-400 text-sm font-sans line-clamp-2">
                              {huddle.screenshot_text.substring(0, 150)}...
                            </p>
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
                            <div className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                              <p className="text-white text-sm font-sans">
                                {huddle.final_reply || huddle.generated_reply}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};
