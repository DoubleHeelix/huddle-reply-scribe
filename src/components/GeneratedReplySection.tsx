
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Copy } from "lucide-react";
import { ToneSelector } from "@/components/ToneSelector";

interface GeneratedReplySectionProps {
  generatedReply: string;
  selectedTone: string;
  isGenerating: boolean;
  isAdjustingTone: boolean;
  onToneChange: (tone: string) => void;
  onApplyTone: () => void;
  onCopyReply: () => void;
  onRegenerate: () => void;
  onReset: () => void;
}

export const GeneratedReplySection: React.FC<GeneratedReplySectionProps> = ({
  generatedReply,
  selectedTone,
  isGenerating,
  isAdjustingTone,
  onToneChange,
  onApplyTone,
  onCopyReply,
  onRegenerate,
  onReset
}) => {
  if (!generatedReply) return null;

  return (
    <Card className="bg-gray-800 border-gray-700" data-section="generated-reply">
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-medium font-sans">Generated Reply</h3>
            <Button
              onClick={onCopyReply}
              variant="outline"
              size="sm"
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
          <ToneSelector
            selectedTone={selectedTone}
            onToneChange={onToneChange}
            onApplyTone={onApplyTone}
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
            onClick={onRegenerate}
            variant="outline" 
            className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-12 font-sans"
            disabled={isGenerating}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            {isGenerating ? "Regenerating..." : "Regenerate"}
          </Button>
          <Button 
            onClick={onReset}
            variant="outline"
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-12 sm:w-auto font-sans"
          >
            New Huddle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
