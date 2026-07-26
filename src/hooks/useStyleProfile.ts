import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  parseStyleProfile,
  type StyleProfile,
} from "@/types/styleProfile";

export const useStyleProfile = (userId?: string) => {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: profileError } = await supabase
        .from("user_style_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      setProfile(data ? parseStyleProfile(data) : null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your reply profile.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const analyzeFromReplies = useCallback(async () => {
    if (!userId) throw new Error("Sign in to build your reply profile.");
    setIsAnalyzing(true);
    setError(null);
    try {
      const { data, error: analysisError } = await supabase.functions.invoke(
        "enhanced-ai-suggestions",
        {
          body: { action: "analyzeStyle", userId },
        },
      );
      if (analysisError) throw analysisError;
      if (!data || data.message) {
        throw new Error(
          data?.message ||
            "Create a few replies first so Huddle has something to learn from.",
        );
      }
      return parseStyleProfile(data);
    } catch (analysisFailure) {
      const message =
        analysisFailure instanceof Error
          ? analysisFailure.message
          : "Unable to learn from your replies.";
      setError(message);
      throw analysisFailure;
    } finally {
      setIsAnalyzing(false);
    }
  }, [userId]);

  const saveProfile = useCallback(
    async (nextProfile: StyleProfile) => {
      if (!userId) throw new Error("Sign in to save your reply profile.");
      setIsSaving(true);
      setError(null);
      try {
        const { data, error: saveError } = await supabase.functions.invoke(
          "enhanced-ai-suggestions",
          {
            body: {
              action: "confirmAndSaveStyle",
              userId,
              analysisData: nextProfile,
            },
          },
        );
        if (saveError) throw saveError;
        const savedProfile = parseStyleProfile(data);
        setProfile(savedProfile);
        return savedProfile;
      } catch (saveFailure) {
        const message =
          saveFailure instanceof Error
            ? saveFailure.message
            : "Unable to save your reply profile.";
        setError(message);
        throw saveFailure;
      } finally {
        setIsSaving(false);
      }
    },
    [userId],
  );

  return {
    profile,
    isLoading,
    isAnalyzing,
    isSaving,
    error,
    loadProfile,
    analyzeFromReplies,
    saveProfile,
  };
};
