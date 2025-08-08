
import { useInterruptions } from "@/hooks/useInterruptions";
import { MultiImageUpload } from "@/components/MultiImageUpload";
import { InterruptionsCarousel } from "@/components/InterruptionsCarousel";
import { Button } from "./ui/button";
import { Story } from "@/types/story";

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
        <h3 className="text-white text-xl font-semibold font-sans">📸 Story Interruption Generator</h3>
        <p className="text-gray-400 text-sm font-sans">
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
            className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white py-3 text-lg font-medium rounded-xl font-sans"
          >
            ➕ Start New Batch
          </Button>
        </div>
      )}
    </div>
  );
};
