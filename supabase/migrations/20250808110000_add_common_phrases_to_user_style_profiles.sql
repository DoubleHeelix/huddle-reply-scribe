-- Adds a JSONB column for phrase-based style profiling
-- Shape: { "bigrams": string[], "trigrams": string[] }
ALTER TABLE public.user_style_profiles
ADD COLUMN IF NOT EXISTS common_phrases jsonb DEFAULT '{"bigrams":[],"trigrams":[]}'::jsonb;