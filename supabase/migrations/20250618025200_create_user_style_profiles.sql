CREATE TABLE public.user_style_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    formality TEXT,
    sentiment TEXT,
    common_topics TEXT[],
    avg_sentence_length INTEGER,
    huddle_count INTEGER
);

ALTER TABLE public.user_style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to access their own style profile"
ON public.user_style_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to create their own style profile"
ON public.user_style_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own style profile"
ON public.user_style_profiles
FOR UPDATE
USING (auth.uid() = user_id);