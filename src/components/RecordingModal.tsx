import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AudioVisualizer } from './AudioVisualizer';
import { useIsMobile } from '@/hooks/use-mobile';

// A simple microphone SVG icon
const MicrophoneIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-[#2f5d8c] dark:text-[#7ea4d6]"
    style={{
      filter: "drop-shadow(0 0 5px #3b82f6) drop-shadow(0 0 15px #3b82f6)",
    }}
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="22"></line>
  </svg>
);

const AnimatedEllipsis = () => (
  <span className="animate-pulse">...</span>
);

interface RecordingModalProps {
  isOpen: boolean;
  transcript: string;
  onComplete: () => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({
  isOpen,
  transcript,
  onComplete,
}) => {
  const isMobile = useIsMobile();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onComplete();
    }
  };

  if (isMobile) {
    // Render a more compact version for mobile screens
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="border-[#826f56]/15 bg-[#fffcf7]/95 backdrop-blur-lg text-[#29231c] flex flex-col items-center p-2 rounded-lg shadow-2xl w-[90vw] max-w-md dark:border-white/10 dark:bg-[#171513]/95 dark:text-[#f4efe7]">
          <DialogHeader>
            <DialogTitle className="sr-only">Recording in progress</DialogTitle>
            <DialogDescription className="sr-only">A modal to show the status of the recording and the transcribed text.</DialogDescription>
          </DialogHeader>
          <div className="my-2 flex items-center justify-center space-x-4 h-12">
              <AudioVisualizer />
              <div className="relative">
                  <div className="absolute h-10 w-10 bg-[#c49b5d] rounded-full animate-ping opacity-50"></div>
                  <MicrophoneIcon />
              </div>
              <AudioVisualizer />
          </div>
          <Button
            onClick={onComplete}
            className="bg-[#b42318] hover:bg-[#8b3d3d] text-white font-bold py-2 px-4 rounded-lg text-md"
          >
            Stop Recording
          </Button>
          <div className="w-full mt-2 p-2 bg-black bg-opacity-20 rounded-md min-h-[80px] text-md">
              {transcript || <span className="text-[#776b5d] dark:text-[#b4a89a]">Starting to listen<AnimatedEllipsis /></span>}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Render the full version for desktop screens
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="border-[#826f56]/15 bg-[#fffcf7]/95 backdrop-blur-md text-[#29231c] flex flex-col items-center justify-center p-4 rounded-lg shadow-2xl dark:border-white/10 dark:bg-[#171513]/95 dark:text-[#f4efe7]">
        <DialogHeader>
          <DialogTitle className="sr-only">Recording...</DialogTitle>
          <DialogDescription className="sr-only">A modal to show the status of the recording and the transcribed text.</DialogDescription>
        </DialogHeader>
        <div className="my-2 flex items-center justify-center space-x-6 h-16">
            <AudioVisualizer />
            <div className="relative">
                <div className="absolute h-12 w-12 bg-[#c49b5d] rounded-full animate-ping opacity-50"></div>
                <MicrophoneIcon />
            </div>
            <AudioVisualizer />
        </div>
        <div className="w-full p-4 bg-black bg-opacity-20 rounded-md min-h-[100px] text-lg">
            {transcript || <span className="text-[#776b5d] dark:text-[#b4a89a]">Starting to listen<AnimatedEllipsis /></span>}
        </div>
        <DialogFooter className="mt-2">
          <Button
            onClick={onComplete}
            className="bg-[#b42318] hover:bg-[#8b3d3d] text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            Stop Recording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
