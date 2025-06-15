
-- Ensure the documents storage bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  updated_at = now();

-- Create comprehensive RLS policies for the documents bucket
DROP POLICY IF EXISTS "Allow authenticated users to view documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON storage.objects;

-- Allow authenticated users to select files from documents bucket
CREATE POLICY "Allow authenticated users to view documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to insert files into documents bucket
CREATE POLICY "Allow authenticated users to upload documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to update files in documents bucket
CREATE POLICY "Allow authenticated users to update documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to delete files from documents bucket
CREATE POLICY "Allow authenticated users to delete documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- Add RLS policies to document_knowledge table if they don't exist
DO $$
BEGIN
    -- Check if RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'document_knowledge' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.document_knowledge ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'document_knowledge' 
        AND policyname = 'Users can view their own document knowledge'
    ) THEN
        CREATE POLICY "Users can view their own document knowledge" 
        ON public.document_knowledge 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'document_knowledge' 
        AND policyname = 'Users can create their own document knowledge'
    ) THEN
        CREATE POLICY "Users can create their own document knowledge" 
        ON public.document_knowledge 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'document_knowledge' 
        AND policyname = 'Users can update their own document knowledge'
    ) THEN
        CREATE POLICY "Users can update their own document knowledge" 
        ON public.document_knowledge 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'document_knowledge' 
        AND policyname = 'Users can delete their own document knowledge'
    ) THEN
        CREATE POLICY "Users can delete their own document knowledge" 
        ON public.document_knowledge 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;
