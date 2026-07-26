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
import {
  getStyleProfileStrength,
  type StyleProfile,
} from '@/types/styleProfile';

type HuddleState = ReturnType<typeof useHuddleState>;

interface HuddlePlayTabProps {
  huddleState: HuddleState;
  styleProfile: StyleProfile | null;
}

const scrollToReplySection = () => {
  requestAnimationFrame(() => {
    const replySection = document.querySelector(
      '[data-section="generated-reply"]',
    );
    replySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
};

export const HuddlePlayTab: React.FC<HuddlePlayTabProps> = ({
  huddleState,
  styleProfile,
}) => {
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
    currentGenerationId,
    setCurrentGenerationId,
    generateReply,
    adjustTone,
    isGenerating,
    isAdjustingTone,
    recordAcceptance,
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
  const [hasUserEditedReply, setHasUserEditedReply] = useState(false);
  const styleStrength = getStyleProfileStrength(styleProfile);

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

  const getScreenshotText = useCallback((): string => {
    return extractedText || "Please describe what you see in the screenshot or the conversation context that's relevant to the user's draft or direction.";
  }, [extractedText]);

  const handleGenerateReply = useCallback(async () => {
    console.log('Generate reply clicked. Draft length:', userDraft.trim().length, 'Image exists:', !!uploadedImage);

    if (!userDraft.trim()) {
      toast({
        title: "Draft or direction required",
        description:
          "Write a message, or briefly tell Huddle what you want to say.",
        variant: "destructive",
      });
      return;
    }
    if (userDraft.trim().toLowerCase() === "test") {
      toast({
        title: "Add a real draft or direction",
        description:
          "Write the message, or briefly describe what the reply should say.",
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
    setHasUserEditedReply(false);
    scrollToReplySection();
    
    const screenshotText = getScreenshotText();
    
    let latestSlangTerms: string[] | undefined;
    const result = await generateReply(
      screenshotText,
      userDraft,
      false,
      [],
      [],
      (partial, meta) => {
        if (meta?.slangAddressTerms?.length) {
          latestSlangTerms = meta.slangAddressTerms;
        }
        setGeneratedReply(
          sanitizeHumanReply(partial, { slangAddressTerms: latestSlangTerms })
        );
      }
    );
    
    if (result) {
      if (result.huddleId) setCurrentHuddleId(result.huddleId);
      if (result.generationId) setCurrentGenerationId(result.generationId);
      const slangTerms = result.slangAddressTerms || latestSlangTerms;
      setGeneratedReply(
        sanitizeHumanReply(result.reply, { slangAddressTerms: slangTerms })
      );
      
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
        title: styleProfile
          ? "Reply matched to your voice"
          : "Perfect reply generated!",
        description: styleProfile
          ? `Your ${styleStrength.label.toLowerCase()} profile shaped this reply, with ${huddleCount} past replies and ${documentCount} documents for context.`
          : `Your optimized response is ready. Used ${huddleCount} past huddles and ${documentCount} documents.`,
      });

    }
  }, [
    userDraft,
    uploadedImage,
    generateReply,
    toast,
    setGeneratedReply,
    setLastUsedHuddles,
    setLastUsedDocuments,
    setShowKnowledgeSources,
    setCurrentHuddleId,
    setCurrentGenerationId,
    getScreenshotText,
    styleProfile,
    styleStrength.label,
  ]);

  const handleRegenerate = async () => {
    if (!userDraft.trim() || !uploadedImage) return;
    if (userDraft.trim().toLowerCase() === "test") {
      toast({
        title: "Add a real draft or direction",
        description:
          "Write the message, or briefly describe what the reply should say.",
        variant: "destructive",
      });
      return;
    }
    setForceShowReplySection(true);
    setHasUserEditedReply(false);
    scrollToReplySection();
    
    const screenshotText = getScreenshotText();
    let latestSlangTerms: string[] | undefined;
    const result = await generateReply(
      screenshotText,
      userDraft,
      true,
      lastUsedDocuments,
      lastUsedHuddles,
      (partial, meta) => {
        if (meta?.slangAddressTerms?.length) {
          latestSlangTerms = meta.slangAddressTerms;
        }
        setGeneratedReply(
          sanitizeHumanReply(partial, { slangAddressTerms: latestSlangTerms })
        );
      },
      currentHuddleId,
      currentGenerationId,
    );
    
    if (result) {
      if (result.huddleId) setCurrentHuddleId(result.huddleId);
      if (result.generationId) setCurrentGenerationId(result.generationId);
      const slangTerms = result.slangAddressTerms || latestSlangTerms;
      setGeneratedReply(
        sanitizeHumanReply(result.reply, { slangAddressTerms: slangTerms })
      );
      
      setLastUsedHuddles(result.pastHuddles || []);
      setLastUsedDocuments(result.documentKnowledge || []);

      setShowKnowledgeSources(
        (result.pastHuddles && result.pastHuddles.length > 0) ||
        (result.documentKnowledge && result.documentKnowledge.length > 0)
      );
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
    setHasUserEditedReply(false);

    if (currentHuddleId) {
      await recordAcceptance(
        currentHuddleId,
        currentGenerationId,
        'tone_applied',
        cleanAdjusted,
        { tone: selectedTone },
      );
    }

    toast({
      title: "Tone adjusted!",
      description: `Reply updated with ${selectedTone} tone.`,
    });
  };

  const handleCopyReply = useCallback(async () => {
    if (!generatedReply) return;
    
    try {
      await navigator.clipboard.writeText(generatedReply);
      if (currentHuddleId) {
        if (hasUserEditedReply) {
          await recordAcceptance(
            currentHuddleId,
            currentGenerationId,
            'edited',
            generatedReply,
          );
        }
        await recordAcceptance(
          currentHuddleId,
          currentGenerationId,
          'copied',
          generatedReply,
        );
      }
      setHasUserEditedReply(false);
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
  }, [
    currentGenerationId,
    currentHuddleId,
    generatedReply,
    hasUserEditedReply,
    recordAcceptance,
    toast,
  ]);

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
    setHasUserEditedReply(false);
    resetHuddle();
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
          recordAcceptance={recordAcceptance}
        />
      ) : (
        <>
          <ImageUploadSection
            uploadedImage={uploadedImage}
            isOCRProcessing={isOCRProcessing}
            onImageUpload={handleImageUpload}
          />

          {!hasScreenshot && (
            <div className="rounded-xl border border-dashed border-[#826f56]/30 bg-white/45 p-4 text-center text-sm text-[#776b5d] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#b4a89a]">
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
                className="w-full bg-[#c49b5d] hover:bg-[#b58a52] text-[#071326] py-4 text-lg font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-sans h-12 shadow-[0_16px_38px_rgba(181,138,82,0.2)]"
              >
                <Zap className="w-5 h-5 mr-2" />
                {isGenerating ? "Generating..." : "Generate"}
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
                onReplyChange={(reply) => {
                  setGeneratedReply(reply);
                  setHasUserEditedReply(true);
                }}
                onRegenerate={handleRegenerate}
                onReset={handleResetHuddle}
                copiedFeedback={copiedFeedback}
                styleProfile={styleProfile}
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
