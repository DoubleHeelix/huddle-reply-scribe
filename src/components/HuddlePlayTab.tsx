import React, { useEffect, useCallback, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { ImageUploadSection } from './ImageUploadSection';
import { DraftMessageSection } from './DraftMessageSection';
import { GeneratedReplySection } from './GeneratedReplySection';
import { AIKnowledgeSources } from './AIKnowledgeSources';
import { useHuddleState } from '@/hooks/useHuddleState';
import { cn } from "@/lib/utils";

type HuddleState = ReturnType<typeof useHuddleState>;

interface HuddlePlayTabProps {
  huddleState: HuddleState;
}

export const HuddlePlayTab: React.FC<HuddlePlayTabProps> = ({ huddleState }) => {
  const {
    uploadedImage,
    setUploadedImage,
    userDraft,
    setUserDraft,
    generatedReply,
    setGeneratedReply,
    selectedTone,
    setSelectedTone,
    lastUsedHuddles,
    setLastUsedHuddles,
    showKnowledgeSources,
    setShowKnowledgeSources,
    extractedText,
    setExtractedText,
    currentHuddleId,
    setCurrentHuddleId,
    generateReply,
    adjustTone,
    isGenerating,
    isAdjustingTone,
    updateFinalReply,
    extractText,
    isOCRProcessing,
    ocrResult,
    resetHuddle,
    toast,
    lastUsedDocuments,
    setLastUsedDocuments,
    setAutoCroppingEnabled,
  } = huddleState;
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('draft_message');
    if (saved) setUserDraft(saved);
  }, [setUserDraft]);

  // Persist draft as user types
  useEffect(() => {
    if (userDraft) {
      localStorage.setItem('draft_message', userDraft);
    } else {
      localStorage.removeItem('draft_message');
    }
  }, [userDraft]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset the state for a new huddle before processing the new image
      resetHuddle();

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageDataUrl = e.target?.result as string;
        setUploadedImage(imageDataUrl);
        
        try {
          // Immediately start OCR processing
          console.log('OCR: Starting text extraction from uploaded image...');
          const text = await extractText(file);
          setExtractedText(text);
          
          toast({
            title: "Screenshot uploaded!",
            description: ocrResult?.success
              ? `Text extracted.`
              : "text extracted.",
          });

        } catch (error) {
          console.error("Error during OCR, retrying without auto-cropping:", error);
          setAutoCroppingEnabled(false);
          try {
            const text = await extractText(file);
            setExtractedText(text);
            toast({
              title: "Screenshot uploaded!",
              description: "Text extracted without auto-cropping.",
            });
          } catch (retryError) {
            console.error("Error during OCR retry:", retryError);
            toast({
              title: "Error",
              description: "Please upload again",
              variant: "destructive",
            });
          } finally {
            setAutoCroppingEnabled(true);
          }
        }

        // Auto-scroll to draft section after upload
        setTimeout(() => {
          const draftSection = document.querySelector('[data-section="draft"]');
          if (draftSection) {
            draftSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      };
      reader.readAsDataURL(file);

      // Clear the input value to allow re-uploading the same file
      event.target.value = '';
    }
  };

  const getScreenshotText = (): string => {
    return extractedText || "Please describe what you see in the screenshot or the conversation context that's relevant to your draft message.";
  };

  const handleGenerateReply = async () => {
    console.log('Generate reply clicked. Draft length:', userDraft.trim().length, 'Image exists:', !!uploadedImage);
    
    if (!userDraft.trim()) {
      toast({
        title: "Draft required",
        description: "Please write your draft message first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!uploadedImage) {
      toast({
        title: "Screenshot required",
        description: "Please upload a screenshot first.",
        variant: "destructive",
      });
      return;
    }
    
    const screenshotText = getScreenshotText();

    // Scroll to Step 3 immediately on click so the user sees the output area.
    const replySection = document.querySelector('[data-section="generated-reply"]');
    if (replySection) {
      replySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    const result = await generateReply(screenshotText, userDraft, false);
    
    if (result) {
      setGeneratedReply(result.reply);
      setSelectedTone("none");
      
      // Store the knowledge sources used for this generation
      setLastUsedHuddles(result.pastHuddles || []);
      setLastUsedDocuments(result.documentKnowledge || []);
      
      // Show knowledge sources section when we have data
      setShowKnowledgeSources(
        (result.pastHuddles && result.pastHuddles.length > 0) ||
        (result.documentKnowledge && result.documentKnowledge.length > 0)
      );
      
      
      const huddleCount = result.pastHuddles?.length || 0;
      const documentCount = result.documentKnowledge?.length || 0;
      
      toast({
        title: "Perfect reply generated!",
        description: `Your optimized response is ready. Used ${huddleCount} past huddles and ${documentCount} documents.`,
      });

      // Auto-scroll to generated reply section
      setTimeout(() => {
        const replySection = document.querySelector('[data-section="generated-reply"]');
        if (replySection) {
          replySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  };

  const handleRegenerate = async () => {
    if (!userDraft.trim() || !uploadedImage) return;
    
    const screenshotText = getScreenshotText();
    const result = await generateReply(screenshotText, userDraft, true, lastUsedDocuments, lastUsedHuddles);
    
    if (result) {
      setGeneratedReply(result.reply);
      setSelectedTone("none");
      
      setLastUsedHuddles(result.pastHuddles || []);
      setLastUsedDocuments(result.documentKnowledge || []);

      setShowKnowledgeSources(
        (result.pastHuddles && result.pastHuddles.length > 0) ||
        (result.documentKnowledge && result.documentKnowledge.length > 0)
      );
      
      if (currentHuddleId) {
        await updateFinalReply(currentHuddleId, result.reply);
      }
      
      toast({
        title: "New reply generated!",
        description: "Here's an alternative version for you.",
      });
    }
  };

  const handleApplyTone = async () => {
    if (!generatedReply || selectedTone === 'none') return;
    
    const adjustedReply = await adjustTone(generatedReply, selectedTone);
    
    if (adjustedReply && adjustedReply !== generatedReply) {
      setGeneratedReply(adjustedReply);
      
      if (currentHuddleId) {
        await updateFinalReply(currentHuddleId, adjustedReply);
      }
      
      toast({
        title: "Tone adjusted!",
        description: `Reply updated with ${selectedTone} tone and saved.`,
      });
    }
  };

  const handleCopyReply = async () => {
    if (!generatedReply) return;
    
    try {
      await navigator.clipboard.writeText(generatedReply);
      toast({
        title: "Copied!",
        description: "Reply copied to clipboard.",
      });
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 1500);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  // Keyboard shortcuts: Cmd/Ctrl+Enter to generate, Cmd/Ctrl+C to copy reply
  const handleShortcut = useCallback(
    (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!isGenerating) {
          handleGenerateReply();
        }
      }
      if (event.key.toLowerCase() === 'c' && generatedReply) {
        event.preventDefault();
        handleCopyReply();
      }
    },
    [generatedReply, handleCopyReply, handleGenerateReply, isGenerating]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleShortcut]);

  const progressActive = isOCRProcessing || isGenerating || isAdjustingTone;
  const progressPercent = isGenerating ? 80 : isAdjustingTone ? 90 : isOCRProcessing ? 40 : 0;
  const progressLabel = isGenerating
    ? "Generating reply..."
    : isAdjustingTone
    ? "Adjusting tone..."
    : "Processing image...";

  return (
    <div className="space-y-6 relative">
      {progressActive && (
        <div className="sticky top-0 z-20">
          <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden border border-slate-700/60">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400",
              )}
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-label={progressLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1" aria-live="polite">
            {progressLabel}
          </p>
        </div>
      )}

      <ImageUploadSection
        uploadedImage={uploadedImage}
        isOCRProcessing={isOCRProcessing}
        onImageUpload={handleImageUpload}
      />

      <DraftMessageSection
        userDraft={userDraft}
        onUserDraftChange={setUserDraft}
      />

      {/* Generate Button */}
      <Button 
        onClick={handleGenerateReply}
        disabled={isGenerating || !userDraft.trim() || !uploadedImage}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-4 text-lg font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-sans h-12"
      >
        <Zap className="w-5 h-5 mr-2" />
        {isGenerating ? "Generating AI Reply..." : "🪄 Generate AI Reply"}
      </Button>

      {/* Loading state for AI generation */}
      {isGenerating && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-purple-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
            <span className="font-sans">AI is crafting your perfect reply...</span>
          </div>
        </div>
      )}

      <GeneratedReplySection
        generatedReply={generatedReply}
        selectedTone={selectedTone}
        isGenerating={isGenerating}
        isAdjustingTone={isAdjustingTone}
        onToneChange={setSelectedTone}
        onApplyTone={handleApplyTone}
        onCopyReply={handleCopyReply}
        onRegenerate={handleRegenerate}
        onReset={resetHuddle}
        copiedFeedback={copiedFeedback}
      />

      {/* AI Knowledge Sources Section - Show if we have any knowledge data */}
      {showKnowledgeSources && (lastUsedHuddles.length > 0 || lastUsedDocuments.length > 0) && (
        <AIKnowledgeSources
          pastHuddles={lastUsedHuddles}
          documentKnowledge={lastUsedDocuments}
          isVisible={true}
        />
      )}
    </div>
  );
};
