
import { useState, useCallback, useRef } from "react";
import { useScreenshot } from 'use-react-screenshot';
import { useToast } from "@/hooks/use-toast";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { PastHuddlesTab } from "@/components/PastHuddlesTab";
import { InterruptionsTab } from "@/components/InterruptionsTab";
import LandingPage from "@/components/LandingPage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCcw, Copy, Check, AlertTriangle, Upload, FileText } from "lucide-react";
import { useEnhancedAISuggestions } from "@/hooks/useEnhancedAISuggestions";
import { DocumentsTab } from '@/components/DocumentsTab';
import { PDFUploader } from '@/components/PDFUploader';

const Index = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState('');
  const [generatedReply, setGeneratedReply] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState('none');
  const [principles, setPrinciples] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [googleCloudApiKey, setGoogleCloudApiKey] = useState('');
  const [enableAutoCropping, setEnableAutoCropping] = useState(true);
  const [autoCropMargin, setAutoCropMargin] = useState(10);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isTestingOCR, setIsTestingOCR] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const { toast } = useToast();
  const { generateReply, adjustTone, isGenerating, isAdjustingTone, error, clearError } = useEnhancedAISuggestions();

  const ref = useRef(null);
  const { image, takeScreenshot } = useScreenshot({
    component: ref,
    quality: 1.0,
    type: "image/png",
  });

  const handleScreenshot = useCallback(async () => {
    try {
      const img = await takeScreenshot();
      setScreenshot(img);
      setUploadedImage(null);
      clearError();
    } catch (error) {
      console.error("Failed to take screenshot:", error);
      toast({
        title: "Screenshot Failed",
        description: "Failed to capture the screen. Please try again.",
        variant: "destructive",
      });
    }
  }, [takeScreenshot, toast, clearError]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setScreenshot(imageUrl);
      setUploadedImage(imageUrl);
      clearError();
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!screenshot) {
      toast({
        title: "Missing Screenshot",
        description: "Please upload an image or take a screenshot first.",
        variant: "destructive",
      });
      return;
    }

    if (!userDraft) {
      toast({
        title: "Missing Draft",
        description: "Please enter your draft message.",
        variant: "destructive",
      });
      return;
    }

    const result = await generateReply(screenshot, userDraft, principles);
    if (result) {
      setGeneratedReply(result.reply);
    }
  };

  const handleAdjustTone = async () => {
    if (!generatedReply) {
      toast({
        title: "No Reply Generated",
        description: "Please generate a reply first.",
        variant: "destructive",
      });
      return;
    }

    const adjustedReply = await adjustTone(generatedReply, selectedTone);
    if (adjustedReply) {
      setGeneratedReply(adjustedReply);
    }
  };

  const handleRegenerate = async () => {
    if (!screenshot) {
      toast({
        title: "Missing Screenshot",
        description: "Please upload an image or take a screenshot first.",
        variant: "destructive",
      });
      return;
    }

    if (!userDraft) {
      toast({
        title: "Missing Draft",
        description: "Please enter your draft message.",
        variant: "destructive",
      });
      return;
    }

    const result = await generateReply(screenshot, userDraft, principles, true);
    if (result) {
      setGeneratedReply(result.reply);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReply);
    setIsCopied(true);
    toast({
      title: "Reply Copied",
      description: "The generated reply has been copied to your clipboard.",
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTestOCR = async () => {
    setIsTestingOCR(true);
    try {
      const response = await fetch('/api/test-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: screenshot,
          googleCloudApiKey: googleCloudApiKey,
          enableAutoCropping: enableAutoCropping,
          autoCropMargin: autoCropMargin,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "OCR Test Successful",
          description: data.text,
        });
      } else {
        toast({
          title: "OCR Test Failed",
          description: data.error || "Failed to test OCR",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("OCR test error:", error);
      toast({
        title: "OCR Test Error",
        description: "An unexpected error occurred during OCR testing.",
        variant: "destructive",
      });
    } finally {
      setIsTestingOCR(false);
    }
  };

  if (showLanding) {
    return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 rounded-3xl mx-4 mt-4 mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            🤝 Huddle Assistant
          </h1>
          <p className="text-purple-100">Lead confident convos on the go</p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="huddle-play" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-700 rounded-xl mb-6">
              <TabsTrigger value="huddle-play" className="text-white data-[state=active]:bg-purple-600 rounded-lg">
                Huddle Play
              </TabsTrigger>
              <TabsTrigger value="interruptions" className="text-white data-[state=active]:bg-purple-600 rounded-lg">
                Interruptions
              </TabsTrigger>
              <TabsTrigger value="past-huddles" className="text-white data-[state=active]:bg-purple-600 rounded-lg">
                📚 View Past Huddles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="huddle-play" className="space-y-6">
              {/* File Upload Section */}
              <div className="space-y-4">
                <h3 className="text-gray-300 text-lg">Drag and drop file here</h3>
                <p className="text-gray-400 text-sm">Limit 200MB per file • JPG, JPEG, PNG</p>
                
                <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 bg-purple-500/5">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex items-center justify-between w-full">
                    <div className="bg-gray-700 px-4 py-2 rounded-lg border border-gray-600">
                      <span className="text-white">Choose file</span>
                    </div>
                    <span className="text-gray-400">No file chosen</span>
                  </label>
                </div>

                {screenshot && (
                  <div className="mt-4">
                    <img src={screenshot} alt="Uploaded" className="w-full rounded-lg border border-gray-600" />
                  </div>
                )}
              </div>

              {/* Draft Message Section */}
              <div className="space-y-4">
                <h3 className="text-white text-lg">Your Draft Message</h3>
                <Textarea
                  placeholder="Type your message here..."
                  value={userDraft}
                  onChange={(e) => setUserDraft(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 min-h-32 rounded-xl"
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-4 text-lg font-medium rounded-xl"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    🪄 Generate AI Reply
                  </>
                )}
              </Button>

              {/* Regenerate Button */}
              <Button
                onClick={handleRegenerate}
                disabled={isGenerating}
                variant="outline"
                className="w-full bg-gray-700 border-gray-600 text-white hover:bg-gray-600 py-4 text-lg rounded-xl"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="w-5 h-5 mr-2" />
                    Regenerate
                  </>
                )}
              </Button>

              {/* Error Display */}
              {error && (
                <div className="rounded-xl bg-red-900/20 border border-red-700 px-4 py-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-300">Error</h3>
                      <div className="mt-2 text-sm text-red-400">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Reply */}
              {generatedReply && (
                <div className="space-y-4">
                  <h3 className="text-white text-lg">Generated Reply</h3>
                  <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                    <p className="text-white">{generatedReply}</p>
                  </div>
                  <Button
                    onClick={handleCopy}
                    disabled={isCopied}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="interruptions">
              <InterruptionsTab />
            </TabsContent>

            <TabsContent value="past-huddles">
              <PastHuddlesTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <SettingsSidebar
        googleCloudApiKey={googleCloudApiKey}
        onGoogleCloudApiKeyChange={setGoogleCloudApiKey}
        enableAutoCropping={enableAutoCropping}
        onAutoCroppingChange={setEnableAutoCropping}
        autoCropMargin={autoCropMargin}
        onAutoCropMarginChange={setAutoCropMargin}
        onTestOCR={handleTestOCR}
        isTestingOCR={isTestingOCR}
        principles={principles}
        setPrinciples={setPrinciples}
        uploadedImage={uploadedImage}
      />
    </div>
  );
};

export default Index;
