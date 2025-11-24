-- Capture richer stylistic fingerprints for continuity and cadence matching
ALTER TABLE public.user_style_profiles
ADD COLUMN IF NOT EXISTS style_fingerprint jsonb DEFAULT '{}'::jsonb;
