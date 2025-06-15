
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface DraftMessageSectionProps {
  userDraft: string;
  onUserDraftChange: (value: string) => void;
}

export const DraftMessageSection: React.FC<DraftMessageSectionProps> = ({
  userDraft,
  onUserDraftChange
}) => {
  return (
    <Card className="bg-gray-800 border-gray-700" data-section="draft">
      <CardContent className="p-6">
        <h3 className="text-white text-lg font-medium mb-4 font-sans">Your Draft Message</h3>
        <Textarea
          placeholder="Type your draft message here..."
          value={userDraft}
          onChange={(e) => onUserDraftChange(e.target.value)}
          rows={6}
          className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 resize-none font-sans"
        />
      </CardContent>
    </Card>
  );
};
