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
    className="text-blue-400"
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
        <DialogContent className="bg-gray-900 bg-opacity-80 backdrop-blur-lg border-gray-700 text-white flex flex-col items-center p-2 rounded-lg shadow-2xl w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Recording in progress</DialogTitle>
            <DialogDescription className="sr-only">A modal to show the status of the recording and the transcribed text.</DialogDescription>
          </DialogHeader>
          <div className="my-2 flex items-center justify-center space-x-4 h-12">
              <AudioVisualizer />
              <div className="relative">
                  <div className="absolute h-10 w-10 bg-blue-500 rounded-full animate-ping opacity-50"></div>
                  <MicrophoneIcon />
              </div>
              <AudioVisualizer />
          </div>
          <Button
            onClick={onComplete}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-md"
          >
            Stop Recording
          </Button>
          <div className="w-full mt-2 p-2 bg-black bg-opacity-20 rounded-md min-h-[80px] text-md">
              {transcript || <span className="text-gray-400">Starting to listen<AnimatedEllipsis /></span>}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Render the full version for desktop screens
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-gray-900 bg-opacity-70 backdrop-blur-md border-gray-700 text-white flex flex-col items-center justify-center p-4 rounded-lg shadow-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Recording...</DialogTitle>
          <DialogDescription className="sr-only">A modal to show the status of the recording and the transcribed text.</DialogDescription>
        </DialogHeader>
        <div className="my-2 flex items-center justify-center space-x-6 h-16">
            <AudioVisualizer />
            <div className="relative">
                <div className="absolute h-12 w-12 bg-blue-500 rounded-full animate-ping opacity-50"></div>
                <MicrophoneIcon />
            </div>
            <AudioVisualizer />
        </div>
        <div className="w-full p-4 bg-black bg-opacity-20 rounded-md min-h-[100px] text-lg">
            {transcript || <span className="text-gray-400">Starting to listen<AnimatedEllipsis /></span>}
        </div>
        <DialogFooter className="mt-2">
          <Button
            onClick={onComplete}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            Stop Recording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};