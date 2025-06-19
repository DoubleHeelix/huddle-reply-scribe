import React from 'react';
import {
  Dialog,
  DialogContent,
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

  if (isMobile) {
    // Render a more compact version for mobile screens
    return (
      <Dialog open={isOpen}>
        <DialogContent className="bg-gray-900 bg-opacity-80 backdrop-blur-lg border-gray-700 text-white flex flex-col items-center p-4 rounded-lg shadow-2xl w-[90vw] max-w-md">
          <div className="flex items-center w-full">
            <div className="relative mr-4">
              <div className="absolute h-10 w-10 bg-blue-500 rounded-full animate-ping opacity-50"></div>
              <MicrophoneIcon />
            </div>
            <div className="flex-grow text-center text-lg font-semibold">
              Recording...
            </div>
            <Button
              onClick={onComplete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              Stop
            </Button>
          </div>
          <div className="w-full mt-3 p-2 bg-black bg-opacity-25 rounded-md min-h-[60px] text-base">
            {transcript || <span className="text-gray-400">Listening...</span>}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Render the full version for desktop screens
  return (
    <Dialog open={isOpen}>
      <DialogContent className="bg-gray-900 bg-opacity-70 backdrop-blur-md border-gray-700 text-white flex flex-col items-center justify-center p-6 rounded-lg shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold mb-2">
            Recording...
          </DialogTitle>
        </DialogHeader>
        <div className="my-4 flex items-center justify-center space-x-6 h-16">
            <AudioVisualizer />
            <div className="relative">
                <MicrophoneIcon />
            </div>
            <AudioVisualizer />
        </div>
        <div className="w-full p-4 bg-black bg-opacity-20 rounded-md min-h-[100px] text-lg">
            {transcript || <span className="text-gray-400">Starting to listen...</span>}
        </div>
        <DialogFooter className="mt-4">
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