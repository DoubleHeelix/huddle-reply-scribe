import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Zap, RefreshCcw, MessageSquare, History, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedAISuggestions } from "@/hooks/useEnhancedAISuggestions";
import { useHuddlePlays } from "@/hooks/useHuddlePlays";
import { useOCR } from "@/hooks/useOCR";
import { ToneSelector } from "@/components/ToneSelector";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { InterruptionsTab } from "@/components/InterruptionsTab";
import { PastHuddlesTab } from "@/components/PastHuddlesTab";
import LandingPage from "@/components/LandingPage";
import { DocumentProcessor } from "@/components/DocumentProcessor";
import { AIKnowledgeSources } from "@/components/AIKnowledgeSources";

const Index = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  const [selectedTone, setSelectedTone] = useState("none");
  const [principles, setPrinciples] = useState("Follow huddle principles: Clarity, Connection, Brevity, Flow, Empathy. Be warm and natural.");
  
  // New state for tracking AI knowledge sources
  const [lastUsedDocuments, setLastUsedDocuments] = useState<any[]>([]);
  const [lastUsedHuddles, setLastUsedHuddles] = useState<any[]>([]);
  const [showKnowledgeSources, setShowKnowledgeSources] = useState(false);
  
  // OCR Settings
  const [googleCloudApiKey, setGoogleCloudApiKey] = useState("");
  const [enableAutoCropping, setEnableAutoCropping] = useState(true);
  const [autoCropMargin, setAutoCropMargin] = useState(12);
  const [extractedText, setExtractedText] = useState("");
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [currentHuddleId, setCurrentHuddleId] = useState<string | null>(null);

  const { toast } = useToast();

  const { generateReply, adjustTone, isGenerating, isAdjustingTone, error, clearError } = useEnhancedAISuggestions();
  const { saveCurrentHuddle, updateFinalReply } = useHuddlePlays();
  
  const { 
    extractText, 
    isProcessing: isOCRProcessing, 
    lastResult: ocrResult, 
    error: ocrError, 
    clearError: clearOCRError 
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

  // Add the missing handleGetStarted function
  const handleGetStarted = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsTransitioning(false);
    }, 500);
  };

  // Save Google Cloud API key to localStorage
  const handleGoogleCloudApiKeyChange = (key: string) => {
    setGoogleCloudApiKey(key);
    localStorage.setItem('google_cloud_api_key', key);
  };

  // Save auto-cropping settings
  const handleAutoCroppingChange = (enabled: boolean) => {
    setEnableAutoCropping(enabled);
    localStorage.setItem('enable_auto_cropping', JSON.stringify(enabled));
  };

  const handleAutoCropMarginChange = (margin: number) => {
    setAutoCropMargin(margin);
    localStorage.setItem('auto_crop_margin', margin.toString());
  };

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
    }
  };

  const handleTestOCR = async () => {
    if (!uploadedImage) {
      toast({
        title: "No image to test",
        description: "Please upload a screenshot first.",
        variant: "destructive",
      });
      return;
    }

    console.log('OCR: Testing OCR with current screenshot...');
    const text = await extractText(uploadedImage);
    setExtractedText(text);
    
    toast({
      title: "OCR Test Complete",
      description: ocrResult?.success 
        ? `Extracted ${text.length} characters in ${ocrResult.processingTime.toFixed(2)}s`
        : "OCR test completed with issues. Check console for details.",
    });
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
    const result = await generateReply(screenshotText, userDraft, principles, false);
    
    if (result) {
      setGeneratedReply(result.reply);
      setSelectedTone("none");
      
      // Store the knowledge sources used for this generation
      setLastUsedDocuments(result.documentKnowledge || []);
      setLastUsedHuddles(result.pastHuddles || []);
      setShowKnowledgeSources(true);
      
      // Save the huddle play to database for future learning
      const huddleId = await saveCurrentHuddle(
        screenshotText,
        userDraft,
        result.reply,
        principles,
        selectedTone
      );
      setCurrentHuddleId(huddleId);
      
      toast({
        title: "Perfect reply generated!",
        description: "Your optimized response is ready and incorporates relevant document knowledge.",
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
    const result = await generateReply(screenshotText, userDraft, principles, true);
    
    if (result) {
      setGeneratedReply(result.reply);
      setSelectedTone("none");
      
      // Update knowledge sources for regeneration
      setLastUsedDocuments(result.documentKnowledge || []);
      setLastUsedHuddles(result.pastHuddles || []);
      
      // Update the current huddle with the new reply
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
      
      // Update the final reply in the database
      if (currentHuddleId) {
        await updateFinalReply(currentHuddleId, adjustedReply);
      }
      
      toast({
        title: "Tone adjusted!",
        description: `Reply updated with ${selectedTone} tone and saved.`,
      });
    }
  };

  const resetHuddle = () => {
    setUploadedImage(null);
    setUserDraft("");
    setGeneratedReply("");
    setSelectedTone("none");
    setExtractedText("");
    setShowExtractedText(false);
    setCurrentHuddleId(null);
    setShowKnowledgeSources(false);
    setLastUsedDocuments([]);
    setLastUsedHuddles([]);
  };

  if (showLanding) {
    return (
      <div className={`transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        <LandingPage onGetStarted={handleGetStarted} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      {/* Settings Sidebar */}
      <SettingsSidebar
        googleCloudApiKey={googleCloudApiKey}
        onGoogleCloudApiKeyChange={handleGoogleCloudApiKeyChange}
        enableAutoCropping={enableAutoCropping}
        onAutoCroppingChange={handleAutoCroppingChange}
        autoCropMargin={autoCropMargin}
        onAutoCropMarginChange={handleAutoCropMarginChange}
        onTestOCR={uploadedImage ? handleTestOCR : undefined}
        isTestingOCR={isOCRProcessing}
        principles={principles}
        setPrinciples={setPrinciples}
        uploadedImage={uploadedImage}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 rounded-b-3xl mx-4 mt-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 font-sans">🤝 Huddle Assistant</h1>
          <p className="text-purple-100 font-sans">AI-powered conversation suggestions with document knowledge</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <Tabs defaultValue="huddle-play" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 border border-gray-700 rounded-lg p-1">
            <TabsTrigger 
              value="huddle-play" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <MessageSquare className="w-4 h-4" />
              Huddle
            </TabsTrigger>
            <TabsTrigger 
              value="interruptions" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <Camera className="w-4 h-4" />
              Interruptions
            </TabsTrigger>
            <TabsTrigger 
              value="past-huddles" 
              className="flex items-center gap-2 text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white rounded-md transition-all duration-200 font-sans text-xs"
            >
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="huddle-play" className="mt-6 space-y-6">
            {/* File Upload Section */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-300 text-lg font-sans">Upload Screenshot</p>
                    {isOCRProcessing && (
                      <Badge variant="secondary" className="bg-blue-600 font-sans">
                        Processing OCR...
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm font-sans">JPG, JPEG, PNG • Max 10MB</p>
                  
                  <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 bg-purple-500/5">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={isOCRProcessing}
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      <Upload className="w-8 h-8 text-purple-400" />
                      <div className="bg-gray-700 px-6 py-3 rounded-lg border border-gray-600">
                        <span className="text-white font-sans">
                          {isOCRProcessing ? "Processing..." : "Choose file"}
                        </span>
                      </div>
                    </label>
                  </div>
                  
                  {uploadedImage && (
                    <div className="mt-4 space-y-3">
                      <img 
                        src={uploadedImage} 
                        alt="Uploaded screenshot" 
                        className="w-full max-w-lg mx-auto rounded-lg border border-gray-600 shadow-lg"
                      />
                      <div className="flex gap-2 justify-center items-center flex-wrap">
                        <Badge variant="secondary" className="font-sans">Screenshot uploaded</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Draft Message Section */}
            <Card className="bg-gray-800 border-gray-700" data-section="draft">
              <CardContent className="p-6">
                <h3 className="text-white text-lg font-medium mb-4 font-sans">Your Draft Message</h3>
                <Textarea
                  placeholder="Type your draft message here..."
                  value={userDraft}
                  onChange={(e) => setUserDraft(e.target.value)}
                  rows={6}
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 resize-none font-sans"
                />
              </CardContent>
            </Card>

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

            {/* AI Knowledge Sources Section */}
            <AIKnowledgeSources
              documentKnowledge={lastUsedDocuments}
              pastHuddles={lastUsedHuddles}
              isVisible={showKnowledgeSources}
            />

            {/* Generated Reply Section */}
            {generatedReply && (
              <Card className="bg-gray-800 border-gray-700" data-section="generated-reply">
                <CardContent className="p-6 space-y-6">
                  <div className="flex flex-col space-y-4">
                    <h3 className="text-white text-lg font-medium font-sans">Generated Reply</h3>
                    <ToneSelector
                      selectedTone={selectedTone}
                      onToneChange={setSelectedTone}
                      onApplyTone={handleApplyTone}
                      isAdjusting={isAdjustingTone}
                      disabled={!generatedReply || isGenerating}
                    />
                  </div>
                  
                  <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                    <pre className="whitespace-pre-wrap text-white text-sm font-normal font-sans leading-relaxed">
                      {generatedReply}
                    </pre>
                  </div>
                  
                  {/* Loading state for tone adjustment */}
                  {isAdjustingTone && (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 text-purple-400">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400"></div>
                        <span className="text-sm font-sans">Adjusting tone...</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <Button 
                      onClick={handleRegenerate}
                      variant="outline" 
                      className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-12 font-sans"
                      disabled={isGenerating}
                    >
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      {isGenerating ? "Regenerating..." : "Regenerate"}
                    </Button>
                    <Button 
                      onClick={resetHuddle}
                      variant="outline"
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-12 sm:w-auto font-sans"
                    >
                      New Huddle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="interruptions" className="mt-6">
            <InterruptionsTab />
          </TabsContent>
          
          <TabsContent value="past-huddles" className="mt-6">
            <PastHuddlesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
