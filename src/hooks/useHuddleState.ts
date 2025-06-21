import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEnhancedAISuggestions } from '@/hooks/useEnhancedAISuggestions';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { useOCR } from '@/hooks/useOCR';

export const useHuddleState = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  const [selectedTone, setSelectedTone] = useState("none");
  const [lastUsedHuddles, setLastUsedHuddles] = useState<any[]>([]);
  const [showKnowledgeSources, setShowKnowledgeSources] = useState(false);
  const [googleCloudApiKey, setGoogleCloudApiKey] = useState("");
  const [enableAutoCropping, setEnableAutoCropping] = useState(true);
  const [autoCropMargin, setAutoCropMargin] = useState(12);
  const [extractedText, setExtractedText] = useState("");
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [currentHuddleId, setCurrentHuddleId] = useState<string | null>(null);
  const [lastUsedDocuments, setLastUsedDocuments] = useState<any[]>([]);
  const [interruptionImage, setInterruptionImage] = useState<string | null>(null);
  const [interruptionText, setInterruptionText] = useState("");
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [editedStarter, setEditedStarter] = useState("");

  const { toast } = useToast();

  const { generateReply, adjustTone, isGenerating, isAdjustingTone, error, clearError } = useEnhancedAISuggestions();
  const { saveCurrentHuddle, updateFinalReply } = useHuddlePlays();
  
  const { 
    extractText, 
    isProcessing: isOCRProcessing, 
    lastResult: ocrResult, 
    error: ocrError, 
    clearError: clearOCRError,
    setAutoCroppingEnabled: setAutoCrop,
  } = useOCR({
    googleCloudApiKey,
    enableAutoCropping,
    autoCropMargin
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedGoogleCloudKey = localStorage.getItem('google_cloud_api_key');
    const savedAutoCropping = localStorage.getItem('enable_auto_cropping');
    const savedCropMargin = localStorage.getItem('auto_crop_margin');

    if (savedGoogleCloudKey) setGoogleCloudApiKey(savedGoogleCloudKey);
    if (savedAutoCropping) setEnableAutoCropping(JSON.parse(savedAutoCropping));
    if (savedCropMargin) setAutoCropMargin(parseInt(savedCropMargin));
  }, []);

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      toast({
        title: "AI Error",
        description: error,
        variant: "destructive",
      });
      clearError();
    }
  }, [error, toast, clearError]);

  // Show OCR error toast when OCR error occurs
  useEffect(() => {
    if (ocrError) {
      toast({
        title: "OCR Error",
        description: ocrError,
        variant: "destructive",
      });
      clearOCRError();
    }
  }, [ocrError, toast, clearOCRError]);

  const resetHuddle = () => {
    setUploadedImage(null);
    setUserDraft("");
    setGeneratedReply("");
    setSelectedTone("none");
    setExtractedText("");
    setShowExtractedText(false);
    setCurrentHuddleId(null);
    setShowKnowledgeSources(false);
    setLastUsedHuddles([]);
    setLastUsedDocuments([]);
    setInterruptionImage(null);
    setInterruptionText("");
    setConversationStarters([]);
    setEditedStarter("");
  };

  return {
    // State
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
    googleCloudApiKey,
    setGoogleCloudApiKey,
    enableAutoCropping,
    setEnableAutoCropping,
    autoCropMargin,
    setAutoCropMargin,
    extractedText,
    setExtractedText,
    showExtractedText,
    setShowExtractedText,
    currentHuddleId,
    setCurrentHuddleId,
    interruptionImage,
    setInterruptionImage,
    interruptionText,
    setInterruptionText,
    conversationStarters,
    setConversationStarters,
    editedStarter,
    setEditedStarter,
    
    // Hooks
    generateReply,
    adjustTone,
    isGenerating,
    isAdjustingTone,
    error,
    clearError,
    saveCurrentHuddle,
    updateFinalReply,
    extractText,
    isOCRProcessing,
    ocrResult,
    ocrError,
    clearOCRError,
    setAutoCroppingEnabled: setAutoCrop,
    
    // Functions
    resetHuddle,
    toast,
    lastUsedDocuments,
    setLastUsedDocuments
  };
};
