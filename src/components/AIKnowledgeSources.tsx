
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageSquare, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DocumentKnowledge {
  document_name: string;
  content_chunk: string;
  similarity: number;
}

interface PastHuddle {
  id: string;
  screenshot_text: string;
  user_draft: string;
  generated_reply: string;
  final_reply?: string;
  created_at: string;
}

interface AIKnowledgeSourcesProps {
  documentKnowledge: DocumentKnowledge[];
  pastHuddles: PastHuddle[];
  isVisible: boolean;
}

export const AIKnowledgeSources = ({ documentKnowledge, pastHuddles, isVisible }: AIKnowledgeSourcesProps) => {
  if (!isVisible) return null;

  return (
    <div className="space-y-4">
      {/* Relevant Communication Docs Used by AI */}
      {documentKnowledge.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-purple-400" />
              <h4 className="text-white text-sm font-medium font-sans">
                📄 Relevant Communication Docs Used by AI
              </h4>
            </div>
            <div className="space-y-3">
              {documentKnowledge.map((doc, index) => (
                <div key={index} className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-pink-400" />
                      <span className="text-gray-300 text-sm font-medium font-sans">
                        From: {doc.document_name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-sans">
                      {(doc.similarity * 100).toFixed(1)}% match
                    </Badge>
                  </div>
                  <p className="text-gray-400 text-xs font-sans line-clamp-3">
                    {doc.content_chunk.substring(0, 200)}...
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {pastHuddles.map((huddle, index) => (
                <div key={huddle.id} className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
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
                        {huddle.screenshot_text.substring(0, 100)}...
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-sans">Draft:</p>
                      <p className="text-gray-300 text-xs font-sans line-clamp-1">
                        {huddle.user_draft.substring(0, 80)}...
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-sans">Reply:</p>
                      <p className="text-white text-xs font-sans line-clamp-2">
                        {(huddle.final_reply || huddle.generated_reply).substring(0, 120)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
