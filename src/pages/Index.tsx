
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, MessageSquare, Bot, CheckCircle, Image as ImageIcon, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type HuddleStep = 
  | "upload" 
  | "context" 
  | "extracted" 
  | "draft" 
  | "generated" 
  | "complete";

const Index = () => {
  const [currentStep, setCurrentStep] = useState<HuddleStep>("upload");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedContent, setExtractedContent] = useState("");
  const [context, setContext] = useState({ name: "", relationship: "", platform: "" });
  const [userDraft, setUserDraft] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getStepProgress = () => {
    const steps: HuddleStep[] = ["upload", "context", "extracted", "draft", "generated", "complete"];
    return ((steps.indexOf(currentStep) + 1) / steps.length) * 100;
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        setCurrentStep("context");
        toast({
          title: "Screenshot uploaded!",
          description: "Now let's add some context about this conversation.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleContextSubmit = () => {
    if (!context.name || !context.relationship) {
      toast({
        title: "Missing information",
        description: "Please fill in the person's name and your relationship.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    // Simulate content extraction
    setTimeout(() => {
      setExtractedContent(`Hi! Hope you're doing well. I was just thinking about our time working on that project together at uni and wanted to catch up. How have you been? I remember you were really passionate about that startup idea you had - did you end up pursuing it?`);
      setCurrentStep("extracted");
      setIsProcessing(false);
      toast({
        title: "Content extracted!",
        description: "The message content has been analyzed from your screenshot.",
      });
    }, 2000);
  };

  const handleConfirmExtraction = () => {
    setCurrentStep("draft");
  };

  const handleDraftSubmit = () => {
    if (!userDraft.trim()) {
      toast({
        title: "Draft required",
        description: "Please write your draft response first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    // Simulate AI generation
    setTimeout(() => {
      setGeneratedReply(`Hey ${context.name}! Thanks for reaching out - it's so good to hear from you! 😊 

I've been doing really well, thanks for asking. Actually, I did end up pursuing that startup idea we talked about, and it's been quite the journey! We're now 8 months in and things are really picking up momentum.

I'd love to catch up properly and hear what you've been up to as well. Are you free for a coffee sometime this week? Would be great to reconnect in person!

How's everything going with you? Last I remember, you were considering that graduate program - did you end up going for it?`);
      setCurrentStep("generated");
      setIsProcessing(false);
      toast({
        title: "Perfect reply generated!",
        description: "Your optimized response is ready based on communication best practices.",
      });
    }, 3000);
  };

  const handleSendReply = () => {
    setCurrentStep("complete");
    toast({
      title: "Huddle play complete!",
      description: "Great job! Your communication skills are improving.",
    });
  };

  const resetHuddle = () => {
    setCurrentStep("upload");
    setUploadedImage(null);
    setExtractedContent("");
    setContext({ name: "", relationship: "", platform: "" });
    setUserDraft("");
    setGeneratedReply("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="gradient-purple-blue text-white py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">🏈 Huddle Play Assistant</h1>
            <p className="text-xl opacity-90">Master your communication skills with AI-powered coaching</p>
          </div>
          
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{Math.round(getStepProgress())}% Complete</span>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 max-w-4xl mx-auto">
          
          {/* Step 1: Upload Screenshot */}
          {currentStep === "upload" && (
            <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Upload Screenshot</CardTitle>
                <CardDescription>
                  Upload a screenshot from Instagram, WhatsApp, Messenger, or any messaging platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Label htmlFor="screenshot" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                    <Input
                      id="screenshot"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Add Context */}
          {currentStep === "context" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Add Context</CardTitle>
                    <CardDescription>Tell us about this conversation</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {uploadedImage && (
                  <div className="text-center">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded screenshot" 
                      className="max-w-xs mx-auto rounded-lg shadow-md"
                    />
                  </div>
                )}
                
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Person's Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Ashley"
                      value={context.name}
                      onChange={(e) => setContext({ ...context, name: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="relationship">Your Relationship</Label>
                    <Textarea
                      id="relationship"
                      placeholder="e.g., We know each other from university, worked on a project together, close friends who talked about side hustles..."
                      value={context.relationship}
                      onChange={(e) => setContext({ ...context, relationship: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="platform">Platform</Label>
                    <Input
                      id="platform"
                      placeholder="e.g., Instagram, WhatsApp, Messenger"
                      value={context.platform}
                      onChange={(e) => setContext({ ...context, platform: e.target.value })}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleContextSubmit} 
                  className="w-full"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Extract Message Content"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Extracted Content */}
          {currentStep === "extracted" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Extracted Content</CardTitle>
                    <CardDescription>Here's what we extracted from your screenshot</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Message from {context.name}:</h4>
                  <p className="text-gray-700">{extractedContent}</p>
                </div>
                
                <div className="flex gap-2">
                  <Badge variant="secondary">Platform: {context.platform}</Badge>
                  <Badge variant="secondary">Relationship: University friend</Badge>
                </div>
                
                <Button onClick={handleConfirmExtraction} className="w-full">
                  Looks Good - Let's Draft a Reply
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Draft Reply */}
          {currentStep === "draft" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Draft Your Reply</CardTitle>
                    <CardDescription>How would you respond to {context.name}?</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Their message:</h4>
                  <p className="text-gray-700 text-sm">{extractedContent}</p>
                </div>
                
                <div>
                  <Label htmlFor="draft">Your Draft Response</Label>
                  <Textarea
                    id="draft"
                    placeholder="Write how you would naturally respond to this message..."
                    value={userDraft}
                    onChange={(e) => setUserDraft(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                </div>
                
                <Button 
                  onClick={handleDraftSubmit} 
                  className="w-full"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Generating Optimized Reply..." : "Generate Perfect Reply"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Generated Reply */}
          {currentStep === "generated" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Optimized Reply</CardTitle>
                    <CardDescription>AI-enhanced response based on communication best practices</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <h4 className="font-medium mb-2 text-gray-600">Your Original Draft:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm">
                      {userDraft}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2 text-green-600">✨ Optimized Version:</h4>
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm font-normal text-gray-800">
                        {generatedReply}
                      </pre>
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">🎯 Why this works:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Acknowledges their message warmly</li>
                    <li>• Shows genuine interest in their updates</li>
                    <li>• Suggests a specific next step (meeting for coffee)</li>
                    <li>• Reciprocates by asking about their goals</li>
                    <li>• Maintains the friendly, personal tone</li>
                  </ul>
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleSendReply} className="flex-1">
                    <Zap className="w-4 h-4 mr-2" />
                    Perfect! Send This Reply
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentStep("draft")}>
                    Revise Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 6: Complete */}
          {currentStep === "complete" && (
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl gradient-text">Huddle Play Complete! 🎉</CardTitle>
                <CardDescription>
                  Great job! You've successfully completed a huddle play session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg">
                  <h3 className="font-semibold mb-3">What you learned:</h3>
                  <ul className="text-sm text-left space-y-2">
                    <li>✅ How to extract key context from conversations</li>
                    <li>✅ The importance of warm, personal acknowledgments</li>
                    <li>✅ How to suggest clear next steps in conversations</li>
                    <li>✅ Balancing sharing updates with asking questions</li>
                  </ul>
                </div>
                
                <Button onClick={resetHuddle} size="lg" className="gradient-purple-blue">
                  Start New Huddle Play
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
