
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
    <Card className="bg-slate-900/70 border-white/5 glass-surface" data-section="draft">
      <CardContent className="p-5 sm:p-6 md:p-7 space-y-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-full text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Step 2</p>
            <h3 className="text-white text-lg font-display">Your draft message</h3>
            <p className="text-sm text-slate-400 mt-1">Type or speak the intent; we’ll keep the tone aligned.</p>
          </div>
          <Button
            onClick={startRecording}
            className="bg-gradient-to-r from-purple-500 to-cyan-400 text-white font-medium px-3 py-2 h-9 rounded-full hover:brightness-110 transition disabled:opacity-50 text-sm"
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
          className="bg-slate-900/60 border border-white/10 text-white placeholder:text-slate-400 resize-none font-sans text-base p-4 rounded-xl focus-visible:ring-2 focus-visible:ring-purple-400/60"
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
