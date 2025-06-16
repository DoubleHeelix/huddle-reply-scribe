CREATE POLICY "Allow anonymous users to view documents" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'documents');