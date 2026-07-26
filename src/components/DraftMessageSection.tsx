
import React, { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranscription } from '@/hooks/useTranscription';
import { RecordingModal } from './RecordingModal';
import { FileText, Mic, WandSparkles } from 'lucide-react';
import { getDraftInputGuidance } from '@/utils/draftInput';

interface DraftMessageSectionProps {
  userDraft: string;
  onUserDraftChange: (value: string) => void;
}

export const DraftMessageSection: React.FC<DraftMessageSectionProps> = ({
  userDraft,
  onUserDraftChange,
}) => {
  const {
    connectionStatus,
    transcript,
    startRecording,
    stopRecording,
  } = useTranscription();
  const inputGuidance = getDraftInputGuidance(userDraft);

  // When the transcript from the hook changes, update the parent state
  useEffect(() => {
    if (transcript) {
      onUserDraftChange(transcript);
    }
  }, [transcript, onUserDraftChange]);

  return (
    <Card className="border border-[#826f56]/15 bg-white/90 dark:border-white/10 dark:bg-[#151513] glass-surface" data-section="draft">
      <CardContent className="p-5 sm:p-6 md:p-7 space-y-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-full text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8f5b18] dark:text-[#d5aa67]">Step 2</p>
            <h3 className="text-[#29231c] dark:text-[#f4efe7] text-lg font-display">Your draft or direction</h3>
            <p className="text-sm text-[#776b5d] dark:text-[#b4a89a] mt-1">
              Write the reply yourself, or briefly tell Huddle what you want to
              say.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              onClick={startRecording}
              className="h-9 rounded-full bg-[#c49b5d] px-3 py-2 text-sm font-medium text-[#071326] shadow-sm transition hover:bg-[#b58a52] disabled:opacity-50"
              disabled={connectionStatus !== 'idle'}
            >
              <Mic className="mr-1.5 h-4 w-4" />
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Record Voice'}
            </Button>
          </div>
        </div>
        <Textarea
          placeholder={'Write a reply, or try: “Tell them I’m interested and ask when.”'}
          value={userDraft}
          onChange={(e) => onUserDraftChange(e.target.value)}
          rows={6}
          aria-describedby="draft-input-guidance"
          className="bg-white/80 border border-[#826f56]/15 text-[#29231c] placeholder:text-[#776b5d] resize-none font-sans text-base p-4 rounded-xl focus-visible:ring-2 focus-visible:ring-[#c49b5d]/60 dark:border-white/10 dark:bg-black/20 dark:text-[#f4efe7] dark:placeholder:text-[#b4a89a]"
          disabled={connectionStatus !== 'idle'}
        />
        <div
          id="draft-input-guidance"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl bg-[#f4efe7]/70 px-3 py-2.5 text-xs leading-relaxed text-[#6a5d50] dark:bg-white/[0.04] dark:text-[#b4a89a]"
        >
          {inputGuidance.mode === "draft" ? (
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8f5b18] dark:text-[#d5aa67]" />
          ) : (
            <WandSparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8f5b18] dark:text-[#d5aa67]" />
          )}
          <span>{inputGuidance.message}</span>
        </div>
        <RecordingModal
          isOpen={connectionStatus === 'listening'}
          transcript={transcript}
          onComplete={stopRecording}
        />
      </CardContent>
    </Card>
  );
};
