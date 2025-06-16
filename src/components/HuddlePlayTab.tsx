import React from 'react';
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { ImageUploadSection } from './ImageUploadSection';
import { DraftMessageSection } from './DraftMessageSection';
import { GeneratedReplySection } from './GeneratedReplySection';
import { AIKnowledgeSources } from './AIKnowledgeSources';
import { useHuddleState } from '@/hooks/useHuddleState';

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
    saveCurrentHuddle,
    updateFinalReply,
    extractText,
    isOCRProcessing,
    ocrResult,
    resetHuddle,
    toast,
    lastUsedDocuments,
    setLastUsedDocuments
  } = huddleState;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reset the state for a new huddle before processing the new image
      resetHuddle();

      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageDataUrl = e.target?.result as string;
        setUploadedImage(imageDataUrl);
        
        // Immediately start OCR processing
        console.log('OCR: Starting text extraction from uploaded image...');
        const text = await extractText(file);
        setExtractedText(text);
        
        toast({
          title: "Screenshot uploaded!",
          description: ocrResult?.success
            ? `OCR completed in ${ocrResult.processingTime.toFixed(2)}s. Text extracted successfully.`
            : "Image uploaded. OCR processing may have encountered issues.",
        });

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
      
      // Save the huddle play to database for future learning
      const huddleId = await saveCurrentHuddle(
        screenshotText,
        userDraft,
        result.reply,
        selectedTone
      );
      setCurrentHuddleId(huddleId);
      
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
    const result = await generateReply(screenshotText, userDraft, true);
    
    if (result) {
      setGeneratedReply(result.reply);
      setSelectedTone("none");
      
      setLastUsedHuddles(result.pastHuddles || []);
      setLastUsedDocuments(result.documentKnowledge || []);
      
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
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
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
