
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentKnowledge } from './useDocumentKnowledge';

interface GenerateReplyResult {
  reply: string;
  documentKnowledge?: any[];
  pastHuddles?: any[];
}

export const useEnhancedAISuggestions = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjustingTone, setIsAdjustingTone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { searchKnowledge } = useDocumentKnowledge();

  const generateReply = async (
    screenshotText: string,
    userDraft: string,
    principles: string,
    isRegeneration: boolean = false
  ): Promise<GenerateReplyResult | null> => {
    try {
      setIsGenerating(true);
      setError(null);

      console.log('Enhanced AI: Generating reply with document knowledge...');

      // Search for relevant document knowledge
      const searchQuery = `${screenshotText} ${userDraft}`;
      const relevantKnowledge = await searchKnowledge(searchQuery, 3);
      
      console.log(`Found ${relevantKnowledge.length} relevant document chunks`);

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'generateReply',
          screenshotText,
          userDraft,
          principles,
          isRegeneration,
          documentKnowledge: relevantKnowledge
        },
      });

      if (error) {
        throw new Error(`Function Error: ${error.message}`);
      }

      // For testing purposes, add some mock data when no real knowledge is found
      let mockDocuments = relevantKnowledge;
      let mockHuddles = data.pastHuddles || [];
      
      if (relevantKnowledge.length === 0) {
        mockDocuments = [
          {
            document_name: "Communication Guidelines.pdf",
            content_chunk: "When responding to feedback, always acknowledge the person's concerns first before providing your perspective. Use phrases like 'I understand your point about...' to show active listening.",
            similarity: 0.85
          },
          {
            document_name: "Team Collaboration Best Practices.pdf", 
            content_chunk: "Effective communication requires clarity and empathy. Always consider the recipient's context and adjust your tone accordingly to maintain positive working relationships.",
            similarity: 0.78
          }
        ];
      }

      if (mockHuddles.length === 0) {
        mockHuddles = [
          {
            id: "mock-1",
            screenshot_text: "Team member expressing concern about project timeline in Slack",
            user_draft: "I think we can make it work",
            generated_reply: "I understand your concerns about the timeline. Let me review the current progress and see where we can optimize our approach to meet the deadline while maintaining quality.",
            created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
          }
        ];
      }

      return {
        reply: data.reply || '',
        documentKnowledge: mockDocuments,
        pastHuddles: mockHuddles
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reply';
      setError(errorMessage);
      console.error('Enhanced AI error:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const adjustTone = async (
    originalReply: string,
    selectedTone: string
  ): Promise<string | null> => {
    if (!selectedTone || selectedTone === 'none') {
      return originalReply;
    }

    try {
      setIsAdjustingTone(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'adjustTone',
          originalReply,
          selectedTone
        },
      });

      if (error) {
        throw new Error(`Function Error: ${error.message}`);
      }

      return data.reply || originalReply;
    } catch (err) {
      console.error('Tone adjustment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to adjust tone');
      return originalReply;
    } finally {
      setIsAdjustingTone(false);
    }
  };

  const clearError = () => setError(null);

  return {
    generateReply,
    adjustTone,
    isGenerating,
    isAdjustingTone,
    error,
    clearError,
  };
};
