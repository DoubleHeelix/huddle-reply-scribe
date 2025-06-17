CREATE POLICY "Allow service_role to perform all actions"
ON public.user_style_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);