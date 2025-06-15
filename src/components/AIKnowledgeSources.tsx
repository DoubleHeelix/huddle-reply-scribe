
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PastHuddle {
  id: string;
  screenshot_text: string;
  user_draft: string;
  generated_reply: string;
  final_reply?: string;
  created_at: string;
}

interface AIKnowledgeSourcesProps {
  pastHuddles: PastHuddle[];
  isVisible: boolean;
}

export const AIKnowledgeSources = ({ pastHuddles, isVisible }: AIKnowledgeSourcesProps) => {
  const [expandedHuddles, setExpandedHuddles] = useState<Set<string>>(new Set());

  if (!isVisible) return null;

  const toggleHuddleExpansion = (id: string) => {
    const newExpanded = new Set(expandedHuddles);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedHuddles(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Similar Past Huddle Plays */}
      {pastHuddles.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-yellow-400" />
              <h4 className="text-white text-sm font-medium font-sans">
                🧠 Similar Past Huddle Plays (For Your Reference)
              </h4>
            </div>
            <div className="space-y-3">
              {pastHuddles.map((huddle, index) => {
                const isExpanded = expandedHuddles.has(huddle.id);
                return (
                  <div key={huddle.id} className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                    <div 
                      className="flex items-center justify-between mb-2 cursor-pointer"
                      onClick={() => toggleHuddleExpansion(huddle.id)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {isExpanded ? 
                          <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        }
                        <MessageSquare className="w-4 h-4 text-yellow-400" />
                        <span className="text-gray-300 text-sm font-medium font-sans">
                          Past Huddle {index + 1}
                        </span>
                      </div>
                      <span className="text-gray-400 text-xs font-sans">
                        {formatDistanceToNow(new Date(huddle.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-gray-400 text-xs font-sans">Context:</p>
                        <p className="text-gray-300 text-xs font-sans line-clamp-2">
                          {isExpanded ? huddle.screenshot_text : `${huddle.screenshot_text.substring(0, 100)}...`}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-sans">Draft:</p>
                        <p className="text-gray-300 text-xs font-sans line-clamp-1">
                          {isExpanded ? huddle.user_draft : `${huddle.user_draft.substring(0, 80)}...`}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs font-sans">Reply:</p>
                        <p className="text-white text-xs font-sans line-clamp-2">
                          {isExpanded ? 
                            (huddle.final_reply || huddle.generated_reply) : 
                            `${(huddle.final_reply || huddle.generated_reply).substring(0, 120)}...`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
