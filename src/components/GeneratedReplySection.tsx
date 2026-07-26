
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, RefreshCcw, Copy, Sparkles } from "lucide-react";
import { ToneSelector } from "@/components/ToneSelector";
import { useTypingEffect } from '@/hooks/useTypingEffect';
import { Textarea } from "@/components/ui/textarea";
import {
  getStyleProfileSignals,
  getStyleProfileStrength,
  type StyleProfile,
} from "@/types/styleProfile";

interface GeneratedReplySectionProps {
  generatedReply: string;
  selectedTone: string;
  isGenerating: boolean;
  isAdjustingTone: boolean;
  showInlineLoader?: boolean;
  onToneChange: (tone: string) => void;
  onApplyTone: () => void;
  onCopyReply: () => void;
  onReplyChange: (reply: string) => void;
  onRegenerate: () => void;
  onReset: () => void;
  copiedFeedback?: boolean;
  forceShow?: boolean;
  styleProfile?: StyleProfile | null;
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
  onReplyChange,
  onRegenerate,
  onReset,
  copiedFeedback,
  forceShow = false,
  styleProfile,
}) => {
  const displayedReply = useTypingEffect(generatedReply, 20);
  const showGenerationLoader = showInlineLoader && isGenerating && !isAdjustingTone;
  const styleStrength = getStyleProfileStrength(styleProfile || null);
  const styleSignals = getStyleProfileSignals(styleProfile || null);

  // Keep the section visible while generating or adjusting, even before text arrives.
  if (!forceShow && !generatedReply && !isGenerating && !isAdjustingTone) return null;

  return (
    <Card className="bg-white/90 dark:bg-[#151513] border border-[#826f56]/15 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none glass-surface" data-section="generated-reply">
      <CardContent className="p-5 sm:p-6 md:p-7 space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="w-full text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8f5b18] dark:text-[#d5aa67]">Step 3</p>
            <h3 className="text-[#29231c] dark:text-[#f4efe7] text-lg font-display">Your crafted reply</h3>
          </div>
          <Button
            onClick={onCopyReply}
            variant="outline"
            size="sm"
            className="bg-white/80 border border-[#826f56]/15 text-[#29231c] hover:bg-[#efe7dc] dark:bg-white/[0.04] dark:border-white/10 dark:text-[#f4efe7] dark:hover:bg-white/[0.08] font-sans rounded-full px-4"
          >
            <Copy className="w-4 h-4 mr-2" />
            {copiedFeedback ? "Copied" : "Copy"}
          </Button>
        </div>

        {showGenerationLoader && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-[#776b5d] dark:text-[#b4a89a] text-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#c49b5d]" />
              <span>AI is shaping the perfect reply...</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#efe7dc] dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #a97d45, #d5aa67, #a97d45)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.6s linear infinite"
                }}
              />
            </div>
          </div>
        )}

        {styleProfile && (
          <div className="flex flex-col gap-3 rounded-2xl border border-[#c49b5d]/25 bg-[#c49b5d]/10 p-4 dark:border-[#c49b5d]/18 dark:bg-[#c49b5d]/[0.07] sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c49b5d] text-[#071326] shadow-sm">
              {isGenerating ? (
                <Sparkles className="h-4 w-4 animate-pulse" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#3f3428] dark:text-[#f2e5d5]">
                {isGenerating
                  ? "Matching your voice profile"
                  : "Shaped with your voice profile"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#77634d] dark:text-[#bfae9b]">
                {isGenerating
                  ? "Balancing your usual cadence, phrasing, and accepted replies."
                  : `${styleStrength.label} match based on ${styleProfile.huddle_count} saved replies.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:max-w-[44%] sm:justify-end">
              {styleSignals.slice(0, 3).map((signal) => (
                <span
                  key={signal}
                  className="rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-medium text-[#6b4c24] dark:bg-white/[0.06] dark:text-[#dec08f]"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:gap-6 items-start md:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-[#fffcf7] dark:bg-[#0d0c0b]/70 p-3 rounded-xl border border-[#826f56]/15 dark:border-white/10 shadow-inner">
            <Textarea
              value={isGenerating ? displayedReply : generatedReply}
              onChange={(event) => onReplyChange(event.target.value)}
              readOnly={isGenerating}
              aria-label="Generated reply"
              className="min-h-36 resize-y border-0 bg-transparent text-center text-sm leading-relaxed text-[#29231c] shadow-none focus-visible:ring-1 focus-visible:ring-[#c49b5d]/60 dark:text-[#f4efe7]"
            />
            {!isGenerating && generatedReply && (
              <p className="mt-2 text-center text-xs text-[#776b5d] dark:text-[#b4a89a]">
                Edit anything before you copy.
              </p>
            )}
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
                <div className="text-left py-1 text-sm text-[#8f5b18] dark:text-[#d5aa67] flex items-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#c49b5d]"></div>
                  Adjusting tone...
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto w-full">
              <Button
                onClick={onRegenerate}
                variant="outline"
                className="w-full bg-white/80 border border-[#826f56]/15 text-[#29231c] hover:bg-[#efe7dc] dark:bg-white/[0.04] dark:border-white/10 dark:text-[#f4efe7] dark:hover:bg-white/[0.08] h-11 font-sans"
                disabled={isGenerating}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                {isGenerating ? "Regenerating..." : "Regenerate"}
              </Button>
              <Button
                onClick={onReset}
                variant="outline"
                className="w-full bg-white/80 border border-[#826f56]/15 text-[#29231c] hover:bg-[#efe7dc] dark:bg-white/[0.04] dark:border-white/10 dark:text-[#f4efe7] dark:hover:bg-white/[0.08] h-11 font-sans"
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
