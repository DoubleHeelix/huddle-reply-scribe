
import { useState } from 'react';
import { generateStoryResponse } from '@/utils/interruptionsService';
import { Story } from '@/types/story';
import { useOCR } from './useOCR';

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read Story image"));
    reader.readAsDataURL(file);
  });

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
        // OCR and generation use the local image directly; Story screenshots are
        // never placed in public storage.
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'ocr' } : s));
        const [ocrText, imageData] = await Promise.all([
          extractText(story.file),
          fileToDataUrl(story.file),
        ]);
        setStories(prev => prev.map(s => s.id === story.id ? { ...s, ocrText } : s));

        setStories(prev => prev.map(s => s.id === story.id ? { ...s, status: 'generating' } : s));
        const interruptions = await generateStoryResponse({
          storyText: ocrText,
          imageData,
        });
        
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
