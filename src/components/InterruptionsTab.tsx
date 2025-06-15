
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, RefreshCcw, Copy, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInterruptions } from "@/hooks/useInterruptions";
import { useOCR } from "@/hooks/useOCR";

export const InterruptionsTab = () => {
  const [uploadedStoryImage, setUploadedStoryImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState("");
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [userEdit, setUserEdit] = useState("");
  const [uploaderKey, setUploaderKey] = useState(0);
  
  const { toast } = useToast();
  
  const { 
    generateConversationStarters, 
    isGenerating, 
    error: interruptionsError 
  } = useInterruptions();
  
  const { 
    extractText, 
    isProcessing: isOCRProcessing 
  } = useOCR({
    enableAutoCropping: true,
    autoCropMargin: 12
  });

  const handleStoryImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageDataUrl = e.target?.result as string;
        setUploadedStoryImage(imageDataUrl);
        
        // Extract text from the story image
        console.log('OCR: Starting text extraction from story image...');
        const text = await extractText(file);
        setStoryText(text);
        
        // Auto-generate conversation starters
        await handleGenerateStarters(text, imageDataUrl);
        
        toast({
          title: "Story uploaded!",
          description: "AI is generating conversation starters...",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateStarters = async (text?: string, imageUrl?: string) => {
    const textToUse = text || storyText;
    const imageToUse = imageUrl || uploadedStoryImage;
    
    if (!imageToUse) {
      toast({
        title: "No image uploaded",
        description: "Please upload a story image first.",
        variant: "destructive",
      });
      return;
    }

    const starters = await generateConversationStarters(textToUse, imageToUse);
    if (starters && starters.length > 0) {
      setConversationStarters(starters);
      setUserEdit(starters[0]);
      toast({
        title: "Conversation starters generated!",
        description: `Generated ${starters.length} creative options.`,
      });
    }
  };

  const handleRegenerateAll = () => {
    handleGenerateStarters();
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard.",
    });
  };

  const handleStartNew = () => {
    setUploadedStoryImage(null);
    setStoryText("");
    setConversationStarters([]);
    setUserEdit("");
    setUploaderKey(prev => prev + 1);
  };

  const renderConversationCard = (title: string, message: string, index: number) => (
    <Card key={index} className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white text-sm font-medium">{title}</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyToClipboard(message)}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg border border-gray-600">
          <p className="text-white text-sm">{message}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-white text-xl font-semibold">📸 Story Interruption Generator</h3>
        <p className="text-gray-400 text-sm">
          Upload an Instagram story. The Huddle bot will suggest 3 warm, curious, and authentic replies based on the content.
        </p>
      </div>

      {/* File Upload Section */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-300 text-lg">Upload Story Screenshot</p>
              {isOCRProcessing && (
                <Badge variant="secondary" className="bg-blue-600">
                  Processing...
                </Badge>
              )}
            </div>
            <p className="text-gray-500 text-sm">JPG, JPEG, PNG • Max 10MB</p>
            
            <div className="border-2 border-dashed border-purple-500 rounded-xl p-8 bg-purple-500/5">
              <Input
                type="file"
                accept="image/*"
                onChange={handleStoryImageUpload}
                className="hidden"
                id="story-file-upload"
                key={uploaderKey}
                disabled={isOCRProcessing || isGenerating}
              />
              <label 
                htmlFor="story-file-upload" 
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="w-8 h-8 text-purple-400" />
                <div className="bg-gray-700 px-6 py-3 rounded-lg border border-gray-600">
                  <span className="text-white">
                    {isOCRProcessing || isGenerating ? "Processing..." : "Choose story image"}
                  </span>
                </div>
              </label>
            </div>
            
            {uploadedStoryImage && (
              <div className="mt-4 space-y-3">
                <img 
                  src={uploadedStoryImage} 
                  alt="Uploaded story" 
                  className="w-full max-w-md mx-auto rounded-lg border border-gray-600 shadow-lg"
                />
                <Badge variant="secondary">Story uploaded</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generated Conversation Starters */}
      {conversationStarters.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-white text-lg font-medium">💬 AI Generated Conversation Starters</h4>
          
          <div className="grid gap-4">
            {conversationStarters.map((starter, index) => 
              renderConversationCard(`Conversation Starter #${index + 1}`, starter, index)
            )}
          </div>

          {/* User Edit Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <h4 className="text-white text-lg font-medium mb-4">✏️ Your Adjusted Message</h4>
              <Textarea
                placeholder="Edit the message to your liking..."
                value={userEdit}
                onChange={(e) => setUserEdit(e.target.value)}
                rows={4}
                className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 resize-none mb-4"
              />
              
              <div className="flex gap-3">
                <Button
                  onClick={() => handleCopyToClipboard(userEdit)}
                  variant="outline"
                  className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy My Version
                </Button>
                <Button 
                  onClick={handleRegenerateAll}
                  variant="outline" 
                  className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  disabled={isGenerating || !uploadedStoryImage}
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Regenerate All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Start New Button */}
          <Button 
            onClick={handleStartNew}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-3 text-lg font-medium rounded-xl"
          >
            ➕ Start New Interruption
          </Button>
        </div>
      )}

      {/* Generate Button (when no starters yet) */}
      {uploadedStoryImage && conversationStarters.length === 0 && !isGenerating && (
        <Button 
          onClick={() => handleGenerateStarters()}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-4 text-lg font-medium rounded-xl"
          disabled={!uploadedStoryImage}
        >
          🪄 Generate Conversation Starters
        </Button>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-purple-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
            <span>Generating creative conversation starters...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {interruptionsError && (
        <Card className="bg-red-900/20 border-red-700">
          <CardContent className="p-4">
            <p className="text-red-400">Error: {interruptionsError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
