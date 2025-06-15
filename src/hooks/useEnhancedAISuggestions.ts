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

      console.log('🤖 DEBUG: Enhanced AI - Starting reply generation...');
      console.log('📸 DEBUG: Screenshot text length:', screenshotText.length);
      console.log('✏️ DEBUG: User draft length:', userDraft.length);

      // Create a more comprehensive search query with key terms
      const keyTerms = [
        ...screenshotText.split(' ').filter(word => word.length > 3),
        ...userDraft.split(' ').filter(word => word.length > 3)
      ].slice(0, 10).join(' ');
      
      const searchQueries = [
        `${screenshotText} ${userDraft}`,
        keyTerms,
        screenshotText,
        userDraft
      ];

      console.log('🔍 DEBUG: Will search with multiple queries:', searchQueries);
      
      // Try multiple search approaches to find relevant content
      let relevantKnowledge = [];
      for (const searchQuery of searchQueries) {
        if (relevantKnowledge.length < 3) {
          console.log(`🔍 DEBUG: Searching with query: "${searchQuery.substring(0, 100)}..."`);
          const results = await searchKnowledge(searchQuery, 2);
          console.log(`📋 DEBUG: Query returned ${results.length} results`);
          relevantKnowledge.push(...results);
        }
      }

      // Remove duplicates based on content_chunk
      const uniqueKnowledge = relevantKnowledge.filter((item, index, arr) => 
        arr.findIndex(other => other.content_chunk === item.content_chunk) === index
      ).slice(0, 3);

      console.log(`🎯 DEBUG: Final unique knowledge chunks: ${uniqueKnowledge.length}`);
      uniqueKnowledge.forEach((doc, index) => {
        console.log(`📄 DEBUG: Document ${index + 1}:`, {
          name: doc.document_name,
          similarity: (doc.similarity * 100).toFixed(1) + '%',
          contentLength: doc.content_chunk.length,
          preview: doc.content_chunk.substring(0, 100) + '...'
        });
      });

      console.log('🚀 DEBUG: Calling enhanced-ai-suggestions function...');

      const { data, error } = await supabase.functions.invoke('enhanced-ai-suggestions', {
        body: {
          action: 'generateReply',
          screenshotText,
          userDraft,
          principles,
          isRegeneration,
          documentKnowledge: uniqueKnowledge
        },
      });

      if (error) {
        throw new Error(`Function Error: ${error.message}`);
      }

      console.log('✅ DEBUG: AI Function response received:', {
        replyLength: data.reply?.length || 0,
        pastHuddlesCount: data.pastHuddles?.length || 0
      });

      // Use real data if available, otherwise provide empty arrays
      const documentKnowledge = uniqueKnowledge.length > 0 ? uniqueKnowledge : [];
      const pastHuddles = data.pastHuddles || [];

      console.log('📊 DEBUG: Final response summary:', {
        replyGenerated: !!data.reply,
        documentsUsed: documentKnowledge.length,
        pastHuddlesUsed: pastHuddles.length
      });

      if (documentKnowledge.length > 0) {
        console.log('📚 DEBUG: Documents that influenced the response:');
        documentKnowledge.forEach((doc, index) => {
          console.log(`   ${index + 1}. ${doc.document_name} (${(doc.similarity * 100).toFixed(1)}% match)`);
        });
      } else {
        console.log('⚠️ DEBUG: No documents were used to influence the response');
      }

      return {
        reply: data.reply || '',
        documentKnowledge,
        pastHuddles
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reply';
      setError(errorMessage);
      console.error('❌ DEBUG: Enhanced AI error:', err);
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
