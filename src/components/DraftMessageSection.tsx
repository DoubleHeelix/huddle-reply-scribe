
import React, { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranscription } from '@/hooks/useTranscription';
import { RecordingModal } from './RecordingModal';

interface DraftMessageSectionProps {
  userDraft: string;
  onUserDraftChange: (value: string) => void;
}

export const DraftMessageSection: React.FC<DraftMessageSectionProps> = ({
  userDraft,
  onUserDraftChange
}) => {
  const {
    connectionStatus,
    transcript,
    startRecording,
    stopRecording,
  } = useTranscription();

  // When the transcript from the hook changes, update the parent state
  useEffect(() => {
    if (transcript) {
      onUserDraftChange(transcript);
    }
  }, [transcript, onUserDraftChange]);

  return (
    <Card className="bg-gray-800 border-gray-700" data-section="draft">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-medium font-sans">Your Draft Message</h3>
          <Button
            onClick={startRecording}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={connectionStatus !== 'idle'}
          >
            {connectionStatus === 'connecting' ? 'Connecting...' : 'Record Voice'}
          </Button>
        </div>
        <Textarea
          placeholder="Type or start recording to draft your message..."
          value={userDraft}
          onChange={(e) => onUserDraftChange(e.target.value)}
          rows={6}
          className="bg-purple-500/5 border-2 border-dashed border-purple-500 text-white placeholder:text-slate-400 resize-none font-sans text-base p-4 rounded-lg"
          disabled={connectionStatus !== 'idle'}
        />
        <RecordingModal
          isOpen={connectionStatus === 'listening'}
          transcript={transcript}
          onComplete={stopRecording}
        />
      </CardContent>
    </Card>
  );
};
