ALTER TABLE public.user_style_profiles
ADD CONSTRAINT user_style_profiles_user_id_key UNIQUE (user_id);