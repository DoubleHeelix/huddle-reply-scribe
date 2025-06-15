import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Zap, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
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
          description: "Ready to draft your message.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateReply = () => {
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
    
    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      setGeneratedReply(`Hey! Thanks for reaching out - it's so good to hear from you! 😊 

I've been doing really well, thanks for asking. Actually, I did end up pursuing that startup idea we talked about, and it's been quite the journey! We're now 8 months in and things are really picking up momentum.

I'd love to catch up properly and hear what you've been up to as well. Are you free for a coffee sometime this week? Would be great to reconnect in person!

How's everything going with you? Last I remember, you were considering that graduate program - did you end up going for it?`);
      setIsGenerating(false);
      toast({
        title: "Perfect reply generated!",
        description: "Your optimized response is ready.",
      });
    }, 3000);
  };

  const handleRegenerate = () => {
    if (!userDraft.trim() || !uploadedImage) return;
    
    setIsGenerating(true);
    setTimeout(() => {
      setGeneratedReply(`Hi there! So great to hear from you! 🌟

Things have been amazing on my end - that startup we discussed is actually happening and gaining real traction now! It's been an incredible learning experience.

I'd absolutely love to catch up and hear all about what you've been up to. Coffee this week? I'm curious to know if you ended up pursuing that graduate program you were considering!

Looking forward to reconnecting properly! 😊`);
      setIsGenerating(false);
      toast({
        title: "New reply generated!",
        description: "Here's an alternative version for you.",
      });
    }, 2500);
  };

  const resetHuddle = () => {
    setUploadedImage(null);
    setUserDraft("");
    setGeneratedReply("");
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 rounded-b-3xl mx-4 mt-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">🤝 Huddle Assistant</h1>
          <p className="text-purple-100">Lead confident convos on the go</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <Tabs defaultValue="huddle-play" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-700">
            <TabsTrigger value="huddle-play" className="text-white data-[state=active]:bg-purple-600">
              Huddle Play
            </TabsTrigger>
            <TabsTrigger value="interruptions" className="text-white">
              Interruptions
            </TabsTrigger>
            <TabsTrigger value="past-huddles" className="text-white">
              📚 View Past Huddles
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="huddle-play" className="mt-6 space-y-6">
            {/* File Upload Section */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <p className="text-gray-300 text-lg">Drag and drop file here</p>
                  <p className="text-gray-500 text-sm">Limit 200MB per file • JPG, JPEG, PNG</p>
                  
                  <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 bg-purple-500/5">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      <div className="bg-gray-700 px-6 py-3 rounded-lg border border-gray-600">
                        <span className="text-white">Choose file</span>
                        <span className="text-gray-400 ml-4">No file chosen</span>
                      </div>
                    </label>
                  </div>
                  
                  {uploadedImage && (
                    <div className="mt-4">
                      <img 
                        src={uploadedImage} 
                        alt="Uploaded screenshot" 
                        className="w-full max-w-md mx-auto rounded-lg border border-gray-600 shadow-lg"
                      />
                      <Badge variant="secondary" className="mt-2">Screenshot uploaded</Badge>
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
                  rows={8}
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                />
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateReply}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-4 text-lg font-medium rounded-xl"
            >
              <Zap className="w-5 h-5 mr-2" />
              {isGenerating ? "Generating AI Reply..." : "🪄 Generate AI Reply"}
            </Button>

            {/* Generated Reply Section */}
            {generatedReply && (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-white text-lg font-medium">Generated Reply</h3>
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
                      disabled={isGenerating}
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
