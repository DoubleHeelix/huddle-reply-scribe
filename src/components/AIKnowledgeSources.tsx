import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatExtractedText, renderMarkdownToHtml } from '@/utils/textProcessing';
import type { DocumentKnowledge } from '@/types/document';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PastHuddle {
  id: string;
  screenshot_text?: string;
  user_draft?: string;
  generated_reply?: string;
  final_reply?: string;
  created_at: string;
  similarity: number;
  __preview?: boolean;
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
  const [localHuddles, setLocalHuddles] = useState<PastHuddle[]>(pastHuddles);
  const [localDocs, setLocalDocs] = useState<DocumentKnowledge[]>(documentKnowledge);
  const [hydratingHuddles, setHydratingHuddles] = useState<Set<string>>(new Set());
  const [hydratingDocs, setHydratingDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalHuddles(pastHuddles);
  }, [pastHuddles]);

  useEffect(() => {
    setLocalDocs(documentKnowledge);
  }, [documentKnowledge]);

  if (!isVisible) return null;

  const hydrateHuddle = async (id: string) => {
    if (!id || hydratingHuddles.has(id)) return;
    const target = localHuddles.find((h) => h.id === id);
    if (target && !target.__preview) return;
    setHydratingHuddles((prev) => new Set(prev).add(id));
    try {
      const { data, error } = await supabase
        .from('huddle_plays')
        .select('id, created_at, screenshot_text, user_draft, generated_reply, final_reply')
        .eq('id', id)
        .single();
      if (!error && data) {
        setLocalHuddles((prev) => prev.map((h) => (h.id === id ? { ...h, ...data, __preview: false } : h)));
      }
    } finally {
      setHydratingHuddles((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleHuddleExpansion = (id: string) => {
    const newExpanded = new Set(expandedHuddles);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      void hydrateHuddle(id);
    }
    setExpandedHuddles(newExpanded);
  };

  const hydrateDocument = async (id: string) => {
    if (!id || hydratingDocs.has(id)) return;
    const target = localDocs.find((d) => d.id === id);
    // @ts-expect-error __preview may exist on sanitized meta
    if (target && !(target as any).__preview && target.content_chunk) return;
    setHydratingDocs((prev) => new Set(prev).add(id));
    try {
      const { data, error } = await supabase
        .from('document_knowledge')
        .select('id, document_name, content_chunk, metadata, similarity')
        .eq('id', id)
        .single();
      if (!error && data) {
        setLocalDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
      }
    } finally {
      setHydratingDocs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleDocumentExpansion = (id: string) => {
    const newExpanded = new Set(expandedDocuments);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      void hydrateDocument(id);
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
      {localDocs.length > 0 && (
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-emerald-500" />
              <h4 className="text-slate-900 dark:text-white text-sm font-medium font-sans">
                📚 Knowledge from Your Documents
              </h4>
            </div>
            <div className="space-y-3">
              {localDocs.map((doc, index) => {
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
                const hasSnippet = Boolean(doc.content_chunk);
                const snippetText = hasSnippet ? formatExtractedText(doc.content_chunk) : 'Loading snippet...';
                const snippetHtml = hasSnippet ? renderMarkdownToHtml(doc.content_chunk) : '';
                const documentTime = getDocumentTimeLabel(doc.metadata);
                const fallbackLineTextRaw = snippetText
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
                              handleCopySnippet(docId, snippetText);
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

                        {snippetHtml ? (
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-gray-200 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: snippetHtml }}
                          />
                        ) : (
                          <p className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {snippetText}
                          </p>
                        )}
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
      {localHuddles.length > 0 && (
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <h4 className="text-slate-900 dark:text-white text-sm font-medium font-sans">
                🧠 Similar Past Huddle Plays
              </h4>
            </div>
            <div className="space-y-3">
              {localHuddles.map((huddle) => {
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
