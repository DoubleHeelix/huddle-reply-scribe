import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Zap, RefreshCcw, Settings, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAISuggestions } from "@/hooks/useAISuggestions";
import { useOCR } from "@/hooks/useOCR";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { ToneSelector } from "@/components/ToneSelector";
import { OCRSettings } from "@/components/OCRSettings";
import LandingPage from "@/components/LandingPage";

const Index = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedTone, setSelectedTone] = useState("none");
  const [principles, setPrinciples] = useState("Follow huddle principles: Clarity, Connection, Brevity, Flow, Empathy. Be warm and natural.");
  
  // OCR Settings
  const [googleCloudApiKey, setGoogleCloudApiKey] = useState("");
  const [enableAutoCropping, setEnableAutoCropping] = useState(true);
  const [autoCropMargin, setAutoCropMargin] = useState(12);
  const [extractedText, setExtractedText] = useState("");
  const [showExtractedText, setShowExtractedText] = useState(false);

  const { toast } = useToast();

  const { generateReply, adjustTone, isGenerating, isAdjustingTone, error, clearError } = useAISuggestions({ apiKey });
  
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

  const handleGetStarted = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsTransitioning(false);
    }, 500);
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    const savedGoogleCloudKey = localStorage.getItem('google_cloud_api_key');
    const savedAutoCropping = localStorage.getItem('enable_auto_cropping');
    const savedCropMargin = localStorage.getItem('auto_crop_margin');

    if (savedApiKey) {
      console.log('Loading saved OpenAI API key');
      setApiKey(savedApiKey);
    }
    if (savedGoogleCloudKey) setGoogleCloudApiKey(savedGoogleCloudKey);
    if (savedAutoCropping) setEnableAutoCropping(JSON.parse(savedAutoCropping));
    if (savedCropMargin) setAutoCropMargin(parseInt(savedCropMargin));
  }, []);

  // Save OpenAI API key to localStorage when it changes
  const handleApiKeyChange = (key: string) => {
    console.log('API key changed, saving to localStorage');
    setApiKey(key);
    if (key.trim()) {
      localStorage.setItem('openai_api_key', key);
    } else {
      localStorage.removeItem('openai_api_key');
    }
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
    console.log('Generate reply clicked. API key exists:', !!apiKey, 'Draft length:', userDraft.trim().length, 'Image exists:', !!uploadedImage);
    
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

    if (!apiKey || !apiKey.trim()) {
      toast({
        title: "API Key required",
        description: "Please enter your OpenAI API key first.",
        variant: "destructive",
      });
      return;
    }
    
    const screenshotText = getScreenshotText();
    const reply = await generateReply(screenshotText, userDraft, principles, false);
    
    if (reply) {
      setGeneratedReply(reply);
      setSelectedTone("none");
      toast({
        title: "Perfect reply generated!",
        description: "Your optimized response is ready.",
      });
    }
  };

  const handleRegenerate = async () => {
    if (!userDraft.trim() || !uploadedImage || !apiKey) return;
    
    const screenshotText = getScreenshotText();
    const reply = await generateReply(screenshotText, userDraft, principles, true);
    
    if (reply) {
      setGeneratedReply(reply);
      setSelectedTone("none");
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
      toast({
        title: "Tone adjusted!",
        description: `Reply updated with ${selectedTone} tone.`,
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
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 rounded-b-3xl mx-4 mt-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">🤝 Huddle Assistant</h1>
          <p className="text-purple-100">AI-powered conversation suggestions</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <Tabs defaultValue="huddle-play" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
            <TabsTrigger value="huddle-play" className="text-white data-[state=active]:bg-purple-600">
              Huddle Play
            </TabsTrigger>
            <TabsTrigger value="setup" className="text-white data-[state=active]:bg-purple-600">
              <Settings className="w-4 h-4 mr-1" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="interruptions" className="text-white">
              Interruptions
            </TabsTrigger>
            <TabsTrigger value="past-huddles" className="text-white">
              📚 Past Huddles
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="setup" className="mt-6 space-y-6">
            <ApiKeyInput apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
            
            <OCRSettings
              googleCloudApiKey={googleCloudApiKey}
              onGoogleCloudApiKeyChange={handleGoogleCloudApiKeyChange}
              enableAutoCropping={enableAutoCropping}
              onAutoCroppingChange={handleAutoCroppingChange}
              autoCropMargin={autoCropMargin}
              onAutoCropMarginChange={handleAutoCropMarginChange}
              onTestOCR={uploadedImage ? handleTestOCR : undefined}
              isTestingOCR={isOCRProcessing}
            />
            
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-white text-lg font-medium mb-4">AI Principles</h3>
                <Textarea
                  placeholder="Enter the key principles for AI to follow when generating replies..."
                  value={principles}
                  onChange={(e) => setPrinciples(e.target.value)}
                  rows={4}
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="huddle-play" className="mt-6 space-y-6">
            {/* File Upload Section */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-300 text-lg">Upload Screenshot</p>
                    {isOCRProcessing && (
                      <Badge variant="secondary" className="bg-blue-600">
                        Processing OCR...
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">JPG, JPEG, PNG • Max 10MB</p>
                  
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
                        <span className="text-white">
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
                        <Badge variant="secondary">Screenshot uploaded</Badge>
                        {ocrResult && (
                          <Badge variant="secondary" className="bg-green-600">
                            OCR: {ocrResult.processingTime.toFixed(2)}s
                          </Badge>
                        )}
                        {extractedText && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowExtractedText(!showExtractedText)}
                            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {showExtractedText ? 'Hide' : 'View'} OCR Text
                          </Button>
                        )}
                      </div>
                      
                      {showExtractedText && extractedText && (
                        <Card className="bg-gray-900 border-gray-600">
                          <CardContent className="p-4">
                            <h4 className="text-white text-sm font-medium mb-2">Extracted Text:</h4>
                            <pre className="text-gray-300 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {extractedText}
                            </pre>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Draft Message Section */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-white text-lg font-medium mb-4">Your Draft Message</h3>
                <Textarea
                  placeholder="Type your draft message here..."
                  value={userDraft}
                  onChange={(e) => setUserDraft(e.target.value)}
                  rows={6}
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                />
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateReply}
              disabled={isGenerating || !apiKey?.trim() || !userDraft.trim() || !uploadedImage}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-4 text-lg font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-5 h-5 mr-2" />
              {isGenerating ? "Generating AI Reply..." : "🪄 Generate AI Reply"}
            </Button>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500 space-y-1">
                <div>API Key: {apiKey ? '✓ Set' : '✗ Missing'}</div>
                <div>Draft: {userDraft.trim() ? '✓ Ready' : '✗ Empty'}</div>
                <div>Image: {uploadedImage ? '✓ Uploaded' : '✗ Missing'}</div>
              </div>
            )}

            {/* Generated Reply Section */}
            {generatedReply && (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white text-lg font-medium">Generated Reply</h3>
                    <ToneSelector
                      selectedTone={selectedTone}
                      onToneChange={setSelectedTone}
                      onApplyTone={handleApplyTone}
                      isAdjusting={isAdjustingTone}
                      disabled={!generatedReply || isGenerating}
                    />
                  </div>
                  
                  <div className="bg-gray-900 p-4 rounded-lg border border-gray-600">
                    <pre className="whitespace-pre-wrap text-white text-sm font-normal">
                      {generatedReply}
                    </pre>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleRegenerate}
                      variant="outline" 
                      className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      disabled={isGenerating || !apiKey}
                    >
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                    <Button 
                      onClick={resetHuddle}
                      variant="outline"
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                    >
                      New Huddle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="interruptions" className="mt-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <p className="text-gray-300">Interruptions feature coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="past-huddles" className="mt-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <p className="text-gray-300">Past huddles will be displayed here...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
