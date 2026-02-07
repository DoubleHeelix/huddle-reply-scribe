-- Add missing JSONB fields used by enhanced style profiling flows.
ALTER TABLE public.user_style_profiles
ADD COLUMN IF NOT EXISTS personal_profile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS common_sentences jsonb DEFAULT '[]'::jsonb;
