-- Create the storage bucket for story images
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-images', 'story-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for the new bucket
-- Allow public read access to all images in the bucket
CREATE POLICY "Allow public read access to story images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'story-images' );

-- Allow authenticated users to upload images to the bucket
CREATE POLICY "Allow authenticated users to upload story images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'story-images' );