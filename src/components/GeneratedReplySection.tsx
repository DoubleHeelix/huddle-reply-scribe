
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Copy } from "lucide-react";
import { ToneSelector } from "@/components/ToneSelector";
import { useTypingEffect } from '@/hooks/useTypingEffect';

interface GeneratedReplySectionProps {
  generatedReply: string;
  selectedTone: string;
  isGenerating: boolean;
  isAdjustingTone: boolean;
  showInlineLoader?: boolean;
  onToneChange: (tone: string) => void;
  onApplyTone: () => void;
  onCopyReply: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  copiedFeedback?: boolean;
  forceShow?: boolean;
}

export const GeneratedReplySection: React.FC<GeneratedReplySectionProps> = ({
  generatedReply,
  selectedTone,
  isGenerating,
  isAdjustingTone,
  showInlineLoader = true,
  onToneChange,
  onApplyTone,
  onCopyReply,
  onRegenerate,
  onReset,
  copiedFeedback,
  forceShow = false
}) => {
  const displayedReply = useTypingEffect(generatedReply, 20);
  const showGenerationLoader = showInlineLoader && isGenerating && !isAdjustingTone;

  // Keep the section visible while generating or adjusting, even before text arrives.
  if (!forceShow && !generatedReply && !isGenerating && !isAdjustingTone) return null;

  return (
    <Card className="bg-white dark:bg-slate-900/70 border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-none glass-surface" data-section="generated-reply">
      <CardContent className="p-5 sm:p-6 md:p-7 space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="w-full text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Step 3</p>
            <h3 className="text-slate-900 dark:text-white text-lg font-display">Your crafted reply</h3>
          </div>
          <Button
            onClick={onCopyReply}
            variant="outline"
            size="sm"
            className="bg-white border border-gray-200 text-slate-900 hover:bg-gray-50 dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/20 font-sans rounded-full px-4"
          >
            <Copy className="w-4 h-4 mr-2" />
            {copiedFeedback ? "Copied" : "Copy"}
          </Button>
        </div>

        {showGenerationLoader && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-300 text-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400" />
              <span>AI is shaping the perfect reply...</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #a855f7, #22d3ee, #a855f7)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.6s linear infinite"
                }}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 md:gap-6 items-start md:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-950/80 dark:to-slate-900/60 p-5 rounded-xl border border-gray-200 dark:border-white/10 shadow-inner flex">
            <pre className="whitespace-pre-wrap text-center text-slate-900 dark:text-white text-sm font-normal font-sans leading-relaxed mx-auto">
              {displayedReply}
            </pre>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <ToneSelector
                selectedTone={selectedTone}
                onToneChange={onToneChange}
                onApplyTone={onApplyTone}
                isAdjusting={isAdjustingTone}
                disabled={!generatedReply || isGenerating}
              />

              {isAdjustingTone && (
                <div className="text-left py-1 text-sm text-purple-200 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400"></div>
                  Adjusting tone...
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto w-full">
              <Button
                onClick={onRegenerate}
                variant="outline"
                className="w-full bg-gray-100 border border-gray-200 text-slate-900 hover:bg-gray-200 dark:bg-white/10 dark:border-white/15 dark:text-white dark:hover:bg-white/20 h-11 font-sans"
                disabled={isGenerating}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                {isGenerating ? "Regenerating..." : "Regenerate"}
              </Button>
              <Button
                onClick={onReset}
                variant="outline"
                className="w-full bg-gray-100 border border-gray-200 text-slate-900 hover:bg-gray-200 dark:bg-slate-900 dark:border-white/15 dark:text-white dark:hover:bg-white/10 h-11 font-sans"
              >
                New Huddle
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
