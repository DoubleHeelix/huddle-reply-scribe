-- Create a public bucket for story images if it doesn't exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('story_images', 'story_images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for the new bucket.
-- Allow public read access to all files in the bucket.
CREATE POLICY "Public read access for story_images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'story_images' );

-- Allow authenticated users to upload, update, and delete their own images.
CREATE POLICY "Authenticated users can manage their own images"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'story_images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update their own images"
ON storage.objects FOR UPDATE USING (
  bucket_id = 'story_images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete their own images"
ON storage.objects FOR DELETE USING (
  bucket_id = 'story_images' AND auth.role() = 'authenticated'
);