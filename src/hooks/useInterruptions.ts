
import { useState } from 'react';
import { generateStoryResponse } from '@/utils/interruptionsService';
import { Story } from '@/types/story';
import { useOCR } from './useOCR';
import { supabase } from '@/integrations/supabase/client';

export const useInterruptions = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const { extractText } = useOCR();

  const processStories = async (files: File[]) => {
    const newStories: Story[] = files.map(file => ({
      id: `${Date.now()}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      interruptions: [],
      status: 'pending',
    }));

    setStories(newStories);

    for (const story of newStories) {
      try {
        // 1. Upload to Storage
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'uploading' } : s));
        const filePath = `public/${story.id}`;
        const { error: uploadError } = await supabase.storage
          .from('story_images')
          .upload(filePath, story.file);

        if (uploadError) throw new Error(`Storage Error: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('story_images')
          .getPublicUrl(filePath);

        if (!publicUrl) throw new Error('Could not get public URL for the image.');

        // 2. OCR Step
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'ocr' } : s));
        const ocrText = await extractText(story.file);
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, ocrText } : s));

        // 3. Generation Step
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'generating' } : s));
        const interruptions = await generateStoryResponse({
          storyText: ocrText,
          imageUrl: publicUrl,
        });
        
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, interruptions, status: 'completed' } : s));

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'error', error: errorMessage } : s));
      }
    }
  };

  const clearStories = () => {
    stories.forEach(story => URL.revokeObjectURL(story.previewUrl));
    setStories([]);
  };

  return {
    stories,
    processStories,
    clearStories,
  };
};
