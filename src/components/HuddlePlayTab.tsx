import React, { useEffect, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { ImageUploadSection } from './ImageUploadSection';
import { DraftMessageSection } from './DraftMessageSection';
import { GeneratedReplySection } from './GeneratedReplySection';
import { AIKnowledgeSources } from './AIKnowledgeSources';
import { BatchHuddlesSection } from './BatchHuddlesSection';
import { useHuddleState } from '@/hooks/useHuddleState';
import { sanitizeHumanReply } from '@/utils/sanitizeHumanReply';

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
    huddleMode,
    batchItems,
    setBatchItems,
  } = huddleState;
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [forceShowReplySection, setForceShowReplySection] = useState(false);

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
      setForceShowReplySection(false);
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

    // Ensure Step 3 is shown as soon as generation starts.
    setForceShowReplySection(true);
    scrollToReplySection();
    
    const screenshotText = getScreenshotText();
    
    const result = await generateReply(screenshotText, userDraft, false, [], [], (partial) => {
      setGeneratedReply(sanitizeHumanReply(partial));
    });
    
    if (result) {
      setGeneratedReply(sanitizeHumanReply(result.reply));
      
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

    }
  };

  const handleRegenerate = async () => {
    if (!userDraft.trim() || !uploadedImage) return;
    setForceShowReplySection(true);
    scrollToReplySection();
    
    const screenshotText = getScreenshotText();
    const result = await generateReply(
      screenshotText,
      userDraft,
      true,
      lastUsedDocuments,
      lastUsedHuddles,
      (partial) => {
        setGeneratedReply(sanitizeHumanReply(partial));
      }
    );
    
    if (result) {
      setGeneratedReply(sanitizeHumanReply(result.reply));
      
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
    if (selectedTone === 'none' || !generatedReply) return;

    const adjustedReply = await adjustTone(generatedReply, selectedTone);
    const cleanAdjusted = adjustedReply ? sanitizeHumanReply(adjustedReply) : "";
    if (!cleanAdjusted || cleanAdjusted === generatedReply) return;

    setGeneratedReply(cleanAdjusted);

    if (currentHuddleId) {
      await updateFinalReply(currentHuddleId, cleanAdjusted);
    }

    toast({
      title: "Tone adjusted!",
      description: `Reply updated with ${selectedTone} tone.`,
    });
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

  const handleResetHuddle = () => {
    setForceShowReplySection(false);
    resetHuddle();
  };

  const scrollToReplySection = () => {
    requestAnimationFrame(() => {
      const replySection = document.querySelector('[data-section="generated-reply"]');
      if (replySection) {
        replySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // Keep inline loaders visible during generation/tone adjustment; no overlay needed.
  const showGenerationLoader = isGenerating;

  const hasScreenshot = Boolean(uploadedImage);

  return (
    <div className="space-y-6 relative">
      {huddleMode === 'batch' ? (
        <BatchHuddlesSection
          extractText={extractText}
          generateReply={generateReply}
          adjustTone={adjustTone}
          toast={toast}
          isAdjustingTone={isAdjustingTone}
          batchItems={batchItems}
          setBatchItems={setBatchItems}
        />
      ) : (
        <>
          <ImageUploadSection
            uploadedImage={uploadedImage}
            isOCRProcessing={isOCRProcessing}
            onImageUpload={handleImageUpload}
          />

          {!hasScreenshot && (
            <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-900/40 p-4 text-center text-sm text-slate-400">
              Step 2 (draft + generate) unlocks after you drop a screenshot above.
            </div>
          )}

          <AnimatePresence>
            {hasScreenshot && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="space-y-6"
              >
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

              <GeneratedReplySection
                generatedReply={generatedReply}
                selectedTone={selectedTone}
                isGenerating={isGenerating}
                isAdjustingTone={isAdjustingTone}
                showInlineLoader={showGenerationLoader}
                forceShow={forceShowReplySection}
                onToneChange={setSelectedTone}
                onApplyTone={handleApplyTone}
                onCopyReply={handleCopyReply}
                onRegenerate={handleRegenerate}
                onReset={handleResetHuddle}
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
                </motion.div>
              )}
            </AnimatePresence>
        </>
      )}
    </div>
  );
};
