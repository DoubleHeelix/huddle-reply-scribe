import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatExtractedText } from '@/utils/textProcessing';
import type { DocumentKnowledge } from '@/types/document';
import { cn } from '@/lib/utils';

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

const getMetadataValue = (
  metadata: Record<string, unknown> | undefined,
  key: string
): string | number | undefined => {
  if (!metadata) return undefined;
  const value = metadata[key];
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
};

const getDocumentTimeLabel = (metadata?: Record<string, unknown>) => {
  const raw =
    getMetadataValue(metadata, 'processed_at') ??
    getMetadataValue(metadata, 'created_at') ??
    getMetadataValue(metadata, 'timestamp') ??
    getMetadataValue(metadata, 'uploaded_at');

  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return formatDistanceToNow(date, { addSuffix: true });
};

export const AIKnowledgeSources = ({ pastHuddles, documentKnowledge = [], isVisible }: AIKnowledgeSourcesProps) => {
  const [expandedHuddles, setExpandedHuddles] = useState<Set<string>>(new Set());
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

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

  const handleCopySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippetId(id);
      setTimeout(() => setCopiedSnippetId(null), 1200);
    } catch (error) {
      console.error('Unable to copy snippet', error);
    }
  };


  return (
    <div className="space-y-4">
      {/* Document Knowledge Sources */}
      {documentKnowledge.length > 0 && (
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-emerald-500" />
              <h4 className="text-slate-900 dark:text-white text-sm font-medium font-sans">
                📚 Knowledge from Your Documents
              </h4>
            </div>
            <div className="space-y-3">
              {documentKnowledge.map((doc, index) => {
                const docId = doc.id || `doc-${index}`;
                const isExpanded = expandedDocuments.has(docId);
                const score = Math.round(doc.similarity * 100);
                const page = typeof doc.metadata?.page === 'number' || typeof doc.metadata?.page === 'string'
                  ? doc.metadata.page
                  : undefined;
                const lineNumber = typeof doc.metadata?.line === 'number'
                  ? doc.metadata.line
                  : typeof doc.metadata?.line_number === 'number'
                    ? doc.metadata.line_number
                    : typeof doc.metadata?.start_line === 'number'
                      ? doc.metadata.start_line
                      : undefined;
                const lineText = typeof doc.metadata?.line_text === 'string'
                  ? doc.metadata.line_text
                  : typeof doc.metadata?.highlight === 'string'
                    ? doc.metadata.highlight
                    : undefined;
                const url = typeof doc.metadata?.url === 'string' ? doc.metadata.url : undefined;
                const snippet = formatExtractedText(doc.content_chunk);
                const documentTime = getDocumentTimeLabel(doc.metadata);
                const fallbackLineTextRaw = snippet
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .find((line) => line.length > 0);
                const fallbackLineText =
                  fallbackLineTextRaw && fallbackLineTextRaw.length > 260
                    ? `${fallbackLineTextRaw.slice(0, 260)}…`
                    : fallbackLineTextRaw;
                const highlightedText = lineText || fallbackLineText;

                const relevanceColor = score >= 80
                  ? 'bg-emerald-500'
                  : score >= 50
                    ? 'bg-amber-500'
                    : 'bg-gray-400';

                return (
                  <div
                    key={docId}
                    className="rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 shadow-sm overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/60"
                      onClick={() => toggleDocumentExpansion(docId)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                        <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-slate-800 dark:text-gray-300 text-sm font-medium font-sans truncate">
                          {doc.document_name}
                        </span>
                        {documentTime && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            • {documentTime}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Relevance</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={cn('h-2 rounded-full transition-all', relevanceColor)}
                              style={{ width: `${score}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {score}%
                          </span>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          {page && (
                            <Badge variant="outline" className="text-[11px]">
                              Page {page}
                            </Badge>
                          )}
                          {lineNumber !== undefined && (
                            <Badge variant="outline" className="text-[11px]">
                              Line {lineNumber}
                            </Badge>
                          )}
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Open doc
                            </a>
                          )}
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCopySnippet(docId, snippet);
                            }}
                          >
                            {copiedSnippetId === docId ? 'Copied' : 'Copy snippet'}
                          </button>
                        </div>

                        {highlightedText && (
                          <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-900/20 px-3 py-2">
                            <p className="text-gray-700 dark:text-emerald-100 text-xs font-sans mb-1">
                              Highlighted line{lineNumber !== undefined ? ` (Line ${lineNumber})` : ''}
                            </p>
                            <p className="text-emerald-900 dark:text-emerald-50 text-sm font-sans whitespace-pre-wrap leading-relaxed line-clamp-4">
                              {highlightedText}
                            </p>
                          </div>
                        )}

                        <p className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                          {snippet}
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
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <h4 className="text-slate-900 dark:text-white text-sm font-medium font-sans">
                🧠 Similar Past Huddle Plays
              </h4>
            </div>
            <div className="space-y-3">
              {pastHuddles.map((huddle) => {
                const isExpanded = expandedHuddles.has(huddle.id);
                const score = Math.round(huddle.similarity * 100);
                const relativeTime = formatDistanceToNow(new Date(huddle.created_at), { addSuffix: true });
                const relevanceColor = score >= 80
                  ? 'bg-amber-500'
                  : score >= 50
                    ? 'bg-amber-400'
                    : 'bg-gray-400';

                return (
                  <div
                    key={huddle.id}
                    className="rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 shadow-sm overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/60"
                      onClick={() => toggleHuddleExpansion(huddle.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                        <MessageSquare className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-slate-800 dark:text-gray-300 text-sm font-medium font-sans truncate">
                          Past huddle from {relativeTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Relevance</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={cn('h-2 rounded-full transition-all', relevanceColor)}
                              style={{ width: `${score}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {score}%
                          </span>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-3">
                        <div className="rounded-lg bg-amber-50/80 dark:bg-amber-900/20 px-3 py-2">
                          <p className="text-gray-600 dark:text-gray-400 text-xs font-sans mb-1">Context</p>
                          <p className="text-slate-800 dark:text-gray-200 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                            {formatExtractedText(huddle.screenshot_text)}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-gray-600 dark:text-gray-400 text-xs font-sans">Your Draft</p>
                          <p className="text-slate-800 dark:text-gray-200 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                            {huddle.user_draft}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-gray-600 dark:text-gray-400 text-xs font-sans">Final Reply</p>
                          <p className="text-slate-900 dark:text-white text-sm font-sans whitespace-pre-wrap leading-relaxed">
                            {huddle.final_reply || huddle.generated_reply}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <button
                            type="button"
                            className="font-medium text-amber-600 dark:text-amber-400 hover:underline"
                            onClick={() => toggleHuddleExpansion(huddle.id)}
                          >
                            {isExpanded ? 'Show less' : 'Show full details'}
                          </button>
                          <button
                            type="button"
                            className="hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCopySnippet(`huddle-${huddle.id}`, huddle.final_reply || huddle.generated_reply);
                            }}
                          >
                            {copiedSnippetId === `huddle-${huddle.id}` ? 'Copied' : 'Copy reply'}
                          </button>
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
