
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCcw, Copy, Check, AlertTriangle } from "lucide-react";
import { useEnhancedAISuggestions, type AIResponse } from "@/hooks/useEnhancedAISuggestions";
import { DocumentsTab } from '@/components/DocumentsTab';
import { PDFUploader } from '@/components/PDFUploader';
import { AISources } from "@/components/AISources";

const Index = () => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState('');
  const [generatedReply, setGeneratedReply] = useState<string>('');
  const [aiSources, setAiSources] = useState<AIResponse['sources'] | null>(null);
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
      setAiSources(result.sources || null);
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
      setAiSources(result.sources || null);
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-800 border-gray-700">
              <TabsTrigger value="upload" className="text-white data-[state=active]:bg-gray-700">
                Upload Image
              </TabsTrigger>
              <TabsTrigger value="past-huddles" className="text-white data-[state=active]:bg-gray-700">
                Past Huddles
              </TabsTrigger>
              <TabsTrigger value="interruptions" className="text-white data-[state=active]:bg-gray-700">
                Interruptions
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-white data-[state=active]:bg-gray-700">
                Documents
              </TabsTrigger>
              <TabsTrigger value="pdf-upload" className="text-white data-[state=active]:bg-gray-700">
                Upload PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    <h2 className="text-xl font-semibold">1. Capture Context</h2>
                    <p className="text-gray-400">Take a screenshot or upload an image to provide context for the AI.</p>

                    <div className="flex space-x-4">
                      <Button onClick={handleScreenshot} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                        Take Screenshot
                      </Button>
                      <Input
                        type="file"
                        id="upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleUpload}
                      />
                      <Label htmlFor="upload" className="cursor-pointer bg-gray-700 border-gray-600 text-white hover:bg-gray-600 rounded-md px-4 py-2">
                        Upload Image
                      </Label>
                    </div>

                    {screenshot && (
                      <div className="mt-4">
                        <h3 className="text-lg font-medium">Captured Image</h3>
                        <div ref={ref} className="mt-2">
                          <img src={screenshot} alt="Captured" style={{ maxWidth: '100%', height: 'auto' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700 mt-6">
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    <h2 className="text-xl font-semibold">2. Enter Your Draft</h2>
                    <p className="text-gray-400">Write your initial message or draft to be improved by the AI.</p>
                    <Textarea
                      placeholder="Enter your draft message here..."
                      value={userDraft}
                      onChange={(e) => setUserDraft(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700 mt-6">
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    <h2 className="text-xl font-semibold">3. Generate Reply</h2>
                    <p className="text-gray-400">Generate an improved reply using the AI assistant.</p>

                    <div className="flex items-center space-x-4">
                      <Button onClick={handleGenerate} disabled={isGenerating} className="bg-purple-600 text-white hover:bg-purple-500">
                        {isGenerating ? (
                          <>
                            Generating...
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                          </>
                        ) : (
                          "Generate Reply"
                        )}
                      </Button>

                      <Button onClick={handleRegenerate} disabled={isGenerating} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                        {isGenerating ? (
                          <>
                            Regenerating...
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                          </>
                        ) : (
                          <>
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Regenerate
                          </>
                        )}
                      </Button>
                    </div>

                    {error && (
                      <div className="rounded-md bg-red-100 px-4 py-3 mt-2">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">
                              Error
                            </h3>
                            <div className="mt-2 text-sm text-red-700">
                              <p>{error}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {generatedReply && (
                      <div className="mt-4">
                        <h3 className="text-lg font-medium">Generated Reply</h3>
                        <Textarea
                          readOnly
                          value={generatedReply}
                          className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                        />
                        <div className="flex justify-end mt-2">
                          <Button onClick={handleCopy} disabled={isCopied} variant="secondary" className="bg-green-600 text-white hover:bg-green-500">
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
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {generatedReply && aiSources && (
                <AISources sources={aiSources} />
              )}
            </TabsContent>

            <TabsContent value="past-huddles" className="mt-6">
              <PastHuddlesTab />
            </TabsContent>

            <TabsContent value="interruptions" className="mt-6">
              <InterruptionsTab />
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <DocumentsTab />
            </TabsContent>

            <TabsContent value="pdf-upload" className="mt-6">
              <PDFUploader />
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
