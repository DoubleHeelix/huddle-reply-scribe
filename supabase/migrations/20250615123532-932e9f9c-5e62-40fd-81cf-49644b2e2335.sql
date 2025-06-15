
-- Create the documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create policy to allow authenticated users to select files from documents bucket
CREATE POLICY "Allow authenticated users to view documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- Create policy to allow authenticated users to insert files into documents bucket
CREATE POLICY "Allow authenticated users to upload documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Create policy to allow authenticated users to update files in documents bucket
CREATE POLICY "Allow authenticated users to update documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

-- Create policy to allow authenticated users to delete files from documents bucket
CREATE POLICY "Allow authenticated users to delete documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents');
