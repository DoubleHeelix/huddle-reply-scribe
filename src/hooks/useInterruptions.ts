
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

    const processStory = async (story: Story) => {
      try {
        // 1. Upload to Storage
        console.log(`[${story.id}] Starting upload...`);
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'uploading' } : s));
        const filePath = `public/${story.id}`;
        const { error: uploadError } = await supabase.storage
          .from('story_images')
          .upload(filePath, story.file);

        if (uploadError) {
          console.error(`[${story.id}] Supabase Storage upload error:`, uploadError);
          throw new Error(`Storage Error: ${uploadError.message}`);
        }
        console.log(`[${story.id}] Upload complete. Getting public URL...`);

        const { data: { publicUrl } } = supabase.storage
          .from('story_images')
          .getPublicUrl(filePath);

        if (!publicUrl) {
          console.error(`[${story.id}] Failed to get public URL.`);
          throw new Error('Could not get public URL for the image.');
        }
        console.log(`[${story.id}] Public URL received. Starting OCR...`);

        // 2. OCR Step
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'ocr' } : s));
        const ocrText = await extractText(story.file);
        console.log(`[${story.id}] OCR complete. Text length: ${ocrText?.length || 0}`);
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, ocrText } : s));

        // 3. Generation Step
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'generating' } : s));
        console.log(`[${story.id}] Generating interruptions...`);
        const interruptions = await generateStoryResponse({
          storyText: ocrText,
          imageUrl: publicUrl,
        });
        console.log(`[${story.id}] Interruptions received.`);
        
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, interruptions, status: 'completed' } : s));

      } catch (err) {
        console.error("Error processing story:", err);
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'error', error: "Error: Please upload again" } : s));
      }
    };

    await Promise.all(newStories.map(processStory));
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
