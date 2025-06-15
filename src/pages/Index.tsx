
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, MessageSquare, Bot, CheckCircle, Image as ImageIcon, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedContent, setExtractedContent] = useState("");
  const [context, setContext] = useState({ name: "", relationship: "", platform: "" });
  const [userDraft, setUserDraft] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        toast({
          title: "Screenshot uploaded!",
          description: "Now add context and extract the message content.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExtractContent = () => {
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
      setIsProcessing(false);
      toast({
        title: "Content extracted!",
        description: "Message content has been analyzed from your screenshot.",
      });
    }, 2000);
  };

  const handleGenerateReply = () => {
    if (!userDraft.trim()) {
      toast({
        title: "Draft required",
        description: "Please write your draft response first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!extractedContent) {
      toast({
        title: "Extract content first",
        description: "Please extract the message content before generating a reply.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      setGeneratedReply(`Hey ${context.name}! Thanks for reaching out - it's so good to hear from you! 😊 

I've been doing really well, thanks for asking. Actually, I did end up pursuing that startup idea we talked about, and it's been quite the journey! We're now 8 months in and things are really picking up momentum.

I'd love to catch up properly and hear what you've been up to as well. Are you free for a coffee sometime this week? Would be great to reconnect in person!

How's everything going with you? Last I remember, you were considering that graduate program - did you end up going for it?`);
      setIsGenerating(false);
      toast({
        title: "Perfect reply generated!",
        description: "Your optimized response is ready based on communication best practices.",
      });
    }, 3000);
  };

  const resetHuddle = () => {
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
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 max-w-6xl mx-auto">
          
          {/* Upload Screenshot Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>1. Upload Screenshot</CardTitle>
                  <CardDescription>Upload a screenshot from Instagram, WhatsApp, Messenger, or any messaging platform</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="screenshot" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <ImageIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload screenshot</p>
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
                
                {uploadedImage && (
                  <div className="text-center">
                    <img 
                      src={uploadedImage} 
                      alt="Uploaded screenshot" 
                      className="max-w-full h-48 object-contain mx-auto rounded-lg shadow-md"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Context & Extract Section */}
          {uploadedImage && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>2. Add Context & Extract Message</CardTitle>
                    <CardDescription>Tell us about this conversation and extract the message content</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
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
                        placeholder="e.g., University friends, worked on projects together..."
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
                    
                    <Button 
                      onClick={handleExtractContent} 
                      className="w-full"
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Extracting..." : "Extract Message Content"}
                    </Button>
                  </div>
                  
                  {extractedContent && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Extracted Message from {context.name}:</h4>
                        <p className="text-gray-700 text-sm">{extractedContent}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {context.platform && <Badge variant="secondary">Platform: {context.platform}</Badge>}
                        <Badge variant="secondary">Relationship: University friend</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Draft & Generate Section */}
          {extractedContent && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>3. Draft Your Reply & Generate Perfect Response</CardTitle>
                    <CardDescription>Write your draft, then let AI generate the optimized version</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="draft">Your Draft Response</Label>
                      <Textarea
                        id="draft"
                        placeholder="Write how you would naturally respond to this message..."
                        value={userDraft}
                        onChange={(e) => setUserDraft(e.target.value)}
                        rows={8}
                        className="mt-2"
                      />
                    </div>
                    
                    <Button 
                      onClick={handleGenerateReply} 
                      className="w-full"
                      disabled={isGenerating}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      {isGenerating ? "Generating Perfect Reply..." : "Generate Perfect Reply"}
                    </Button>
                  </div>
                  
                  {generatedReply && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2 text-green-600">✨ Optimized Reply:</h4>
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                          <pre className="whitespace-pre-wrap text-sm font-normal text-gray-800">
                            {generatedReply}
                          </pre>
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
                        <Button className="flex-1">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Perfect! Copy Reply
                        </Button>
                        <Button variant="outline" onClick={resetHuddle}>
                          Start New Huddle
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
