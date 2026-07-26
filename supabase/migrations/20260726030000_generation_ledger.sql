-- Durable generation records make retries, accepted replies, sources, and API
-- spend auditable without storing private prompt text in application logs.

ALTER TABLE public.huddle_plays
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('generating', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS generation_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS huddle_plays_user_request_uidx
  ON public.huddle_plays (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.huddle_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_play_id uuid NOT NULL REFERENCES public.huddle_plays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id uuid,
  parent_generation_id uuid REFERENCES public.huddle_generations(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  model text NOT NULL,
  model_route text NOT NULL,
  reasoning_effort text,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
  generated_reply text,
  provider_request_id text,
  prompt_tokens integer CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens integer CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  reasoning_tokens integer CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  total_tokens integer CHECK (total_tokens IS NULL OR total_tokens >= 0),
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS huddle_generations_huddle_idx
  ON public.huddle_generations (huddle_play_id, started_at DESC);
CREATE INDEX IF NOT EXISTS huddle_generations_user_idx
  ON public.huddle_generations (user_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS huddle_generations_active_request_uidx
  ON public.huddle_generations (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL
    AND status IN ('started', 'completed');

CREATE TABLE IF NOT EXISTS public.huddle_generation_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.huddle_generations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('past_huddle', 'document', 'style_profile')),
  source_id uuid,
  rank integer CHECK (rank IS NULL OR rank > 0),
  similarity double precision,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS huddle_generation_sources_generation_idx
  ON public.huddle_generation_sources (generation_id);

CREATE TABLE IF NOT EXISTS public.huddle_acceptance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_play_id uuid NOT NULL REFERENCES public.huddle_plays(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES public.huddle_generations(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('copied', 'edited', 'tone_applied', 'accepted')),
  final_reply text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS huddle_acceptance_events_user_idx
  ON public.huddle_acceptance_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES public.huddle_generations(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'openai',
  operation text NOT NULL,
  model text NOT NULL,
  model_route text,
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  reasoning_tokens integer NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_micros bigint CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_usage_ledger_user_day_idx
  ON public.api_usage_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.model_routing_policies (
  workflow text PRIMARY KEY,
  primary_model text NOT NULL,
  fallback_model text NOT NULL,
  tone_model text NOT NULL,
  evaluation_version text NOT NULL DEFAULT 'baseline',
  minimum_quality_score numeric(5, 4) NOT NULL DEFAULT 0.85,
  evaluated_sample_count integer NOT NULL DEFAULT 0,
  cheap_route_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.model_routing_policies (
  workflow,
  primary_model,
  fallback_model,
  tone_model,
  evaluation_version,
  minimum_quality_score,
  evaluated_sample_count,
  cheap_route_enabled
)
VALUES (
  'huddle_reply',
  'gpt-5.4-nano',
  'gpt-5-mini',
  'gpt-4o-mini',
  'baseline-2026-07',
  0.85,
  0,
  false
)
ON CONFLICT (workflow) DO NOTHING;

ALTER TABLE public.huddle_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_generation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huddle_acceptance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_routing_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own huddle generations"
  ON public.huddle_generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own huddle generation sources"
  ON public.huddle_generation_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own acceptance events"
  ON public.huddle_acceptance_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own API usage"
  ON public.api_usage_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view active model routing"
  ON public.model_routing_policies FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.record_huddle_acceptance(
  p_huddle_play_id uuid,
  p_generation_id uuid,
  p_event_type text,
  p_final_reply text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN ('copied', 'edited', 'tone_applied', 'accepted') THEN
    RAISE EXCEPTION 'Unsupported acceptance event';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.huddle_plays
    WHERE id = p_huddle_play_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Huddle not found';
  END IF;

  IF p_generation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.huddle_generations
    WHERE id = p_generation_id
      AND huddle_play_id = p_huddle_play_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Generation not found';
  END IF;

  INSERT INTO public.huddle_acceptance_events (
    huddle_play_id,
    generation_id,
    user_id,
    event_type,
    final_reply,
    metadata
  )
  VALUES (
    p_huddle_play_id,
    p_generation_id,
    auth.uid(),
    p_event_type,
    NULLIF(btrim(p_final_reply), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  IF p_event_type IN ('copied', 'accepted')
    AND NULLIF(btrim(p_final_reply), '') IS NOT NULL THEN
    UPDATE public.huddle_plays
    SET
      final_reply = p_final_reply,
      accepted_at = now(),
      updated_at = now()
    WHERE id = p_huddle_play_id
      AND user_id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_huddle_acceptance(uuid, uuid, text, text, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_huddle_acceptance(uuid, uuid, text, text, jsonb)
  TO authenticated;
