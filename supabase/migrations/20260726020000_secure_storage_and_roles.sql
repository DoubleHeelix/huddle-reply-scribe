-- Conversation media and knowledge documents must never be publicly readable.
UPDATE storage.buckets
SET public = false
WHERE id IN ('documents', 'story_images', 'story-images');

-- Remove historical public and broadly mutating document policies.
DROP POLICY IF EXISTS "Allow anonymous users to view documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON storage.objects;

-- Approved knowledge remains readable to authenticated users, while only a
-- server-owned admin role can change the storage contents.
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
CREATE POLICY "Admins can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
CREATE POLICY "Admins can update documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
CREATE POLICY "Admins can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
  )
);

-- Remove all historical public/broad Story policies. The current application
-- processes Story images directly without persisting them, but owner-scoped
-- policies protect any legacy or future private uploads.
DROP POLICY IF EXISTS "Allow public read access to story images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload story images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for story_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage their own images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own images" ON storage.objects;

DROP POLICY IF EXISTS "Users can read their story images" ON storage.objects;
CREATE POLICY "Users can read their story images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('story_images', 'story-images')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can upload their story images" ON storage.objects;
CREATE POLICY "Users can upload their story images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('story_images', 'story-images')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their story images" ON storage.objects;
CREATE POLICY "Users can update their story images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('story_images', 'story-images')
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN ('story_images', 'story-images')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their story images" ON storage.objects;
CREATE POLICY "Users can delete their story images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('story_images', 'story-images')
  AND (storage.foldername(name))[1] = auth.uid()::text
);
