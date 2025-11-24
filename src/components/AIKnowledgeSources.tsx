import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatExtractedText } from '@/utils/textProcessing';
import type { DocumentKnowledge } from '@/types/document';

interface PastHuddle {
  id: string;
  screenshot_text: string;
  user_draft: string;
  generated_reply: string;
  final_reply?: string;
  created_at: string;
  similarity: number;
}

interface AIKnowledgeSourcesProps {
  pastHuddles: PastHuddle[];
  documentKnowledge?: DocumentKnowledge[];
  isVisible: boolean;
}

export const AIKnowledgeSources = ({ pastHuddles, documentKnowledge = [], isVisible }: AIKnowledgeSourcesProps) => {
  const [expandedHuddles, setExpandedHuddles] = useState<Set<string>>(new Set());
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());

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

  const toggleDocumentExpansion = (id: string) => {
    const newExpanded = new Set(expandedDocuments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDocuments(newExpanded);
  };


  return (
    <div className="space-y-4">
      {/* Document Knowledge Sources */}
      {documentKnowledge.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-green-400" />
              <h4 className="text-white text-sm font-medium font-sans">
                📚 Knowledge from Your Documents
              </h4>
            </div>
            <div className="space-y-3">
              {documentKnowledge.map((doc, index) => {
                const isExpanded = expandedDocuments.has(doc.id);
                return (
                  <div key={doc.id || index} className="bg-gray-900 p-3 rounded-lg border border-gray-600">
                    <div
                      className="flex items-center justify-between mb-2 cursor-pointer"
                      onClick={() => toggleDocumentExpansion(doc.id || `doc-${index}`)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isExpanded ?
                          <ChevronDown className="w-4 h-4 text-gray-400" /> :
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        }
                        <FileText className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300 text-sm font-medium font-sans truncate">
                          {doc.document_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">Relevance:</span>
                        <div className="w-16 bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-green-500 h-2.5 rounded-full"
                            style={{ width: `${Math.round(doc.similarity * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-white">
                          {Math.round(doc.similarity * 100)}%
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 pl-6 border-l-2 border-gray-700">
                        <p className="text-gray-300 text-xs font-sans whitespace-pre-wrap">
                          {formatExtractedText(doc.content_chunk)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
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
                🧠 Similar Past Huddle Plays
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isExpanded ?
                          <ChevronDown className="w-4 h-4 text-gray-400" /> :
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        }
                        <MessageSquare className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <span className="text-gray-300 text-sm font-medium font-sans truncate">
                          Past Huddle from {formatDistanceToNow(new Date(huddle.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">Relevance:</span>
                        <div className="w-16 bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-yellow-500 h-2.5 rounded-full"
                            style={{ width: `${Math.round(huddle.similarity * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-white">
                          {Math.round(huddle.similarity * 100)}%
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 pl-6 border-l-2 border-gray-700 space-y-3">
                        <div>
                          <p className="text-gray-400 text-xs font-sans mb-1">Context:</p>
                          <p className="text-gray-300 text-xs font-sans whitespace-pre-wrap">
                            {formatExtractedText(huddle.screenshot_text)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs font-sans mb-1">Your Draft:</p>
                          <p className="text-gray-300 text-xs font-sans whitespace-pre-wrap">
                            {huddle.user_draft}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs font-sans mb-1">Final Reply:</p>
                          <p className="text-white text-xs font-sans whitespace-pre-wrap">
                            {huddle.final_reply || huddle.generated_reply}
                          </p>
                        </div>
                      </div>
                    )}
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
