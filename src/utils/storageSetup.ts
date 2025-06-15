
import { supabase } from '@/integrations/supabase/client';

export const createDocumentsBucket = async () => {
  try {
    console.log('🪣 DEBUG: Creating documents bucket...');
    
    const { data, error } = await supabase.storage.createBucket('documents', {
      public: false,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 10485760 // 10MB
    });

    if (error && !error.message.includes('already exists')) {
      console.error('❌ DEBUG: Error creating bucket:', error);
      throw error;
    }

    console.log('✅ DEBUG: Documents bucket ready');
    return true;
  } catch (error) {
    console.error('❌ DEBUG: Error setting up storage:', error);
    return false;
  }
};

export const uploadPDFFile = async (file: File): Promise<string | null> => {
  try {
    console.log(`📤 DEBUG: Uploading ${file.name}...`);
    
    const fileName = `${Date.now()}-${file.name}`;
    
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (error) {
      console.error('❌ DEBUG: Upload error:', error);
      throw error;
    }

    console.log(`✅ DEBUG: Successfully uploaded ${fileName}`);
    return data.path;
  } catch (error) {
    console.error('❌ DEBUG: Error uploading file:', error);
    return null;
  }
};
