
import { MultiImageUpload } from "@/components/MultiImageUpload";
import { InterruptionsCarousel } from "@/components/InterruptionsCarousel";
import { Button } from "./ui/button";
import { Story } from "@/types/story";
import { Camera, Plus } from "lucide-react";

interface InterruptionsTabProps {
  stories: Story[];
  processStories: (files: File[]) => void;
  clearStories: () => void;
}

export const InterruptionsTab = ({ stories, processStories, clearStories }: InterruptionsTabProps) => {
  const handleFilesSelected = (files: File[]) => {
    processStories(files);
  };

  const isProcessing = stories.some(s => s.status === 'ocr' || s.status === 'generating');

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="flex items-center justify-center gap-2 text-[#29231c] text-xl font-semibold font-sans dark:text-[#f4efe7]">
          <Camera className="h-5 w-5 text-[#a97d45] dark:text-[#d5aa67]" />
          Story Interruption Generator
        </h3>
        <p className="text-[#776b5d] text-sm font-sans dark:text-[#b4a89a]">
          Upload up to 5 Instagram stories. The Huddle bot will suggest 5 warm, curious, and authentic replies for each.
        </p>
      </div>

      {!stories.length ? (
        <MultiImageUpload
          onFilesSelected={handleFilesSelected}
          maxFiles={5}
          isProcessing={isProcessing}
        />
      ) : (
        <div className="space-y-4">
          <InterruptionsCarousel stories={stories} />
          <Button
            onClick={clearStories}
            className="w-full bg-[#c49b5d] hover:bg-[#b58a52] text-[#071326] py-3 text-lg font-medium rounded-xl font-sans"
          >
            <Plus className="h-5 w-5" />
            Start New Batch
          </Button>
        </div>
      )}
    </div>
  );
};
