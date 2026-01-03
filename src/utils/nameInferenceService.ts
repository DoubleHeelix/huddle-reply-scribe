import { supabase } from "@/integrations/supabase/client";

export type NameCandidateResponse = {
  candidate?: string;
  confidence?: number;
  error?: string;
};

const cleanText = (text: string | null | undefined) =>
  (text || "").replace(/[\u0000-\u001F]+/g, "").trim();

export const fetchLLMNameCandidate = async (
  text: string | null | undefined
): Promise<string | null> => {
  const cleaned = cleanText(text);
  if (!cleaned) return null;

  try {
    const { data, error } = await supabase.functions.invoke<NameCandidateResponse>(
      "extract-name",
      {
        body: { text: cleaned },
      }
    );

    if (error) {
      console.error("Error invoking extract-name:", error);
      return null;
    }

    const candidate = data?.candidate;
    if (candidate && candidate !== "UNKNOWN") {
      return candidate;
    }
    return null;
  } catch (err) {
    console.error("Unexpected error invoking extract-name:", err);
    return null;
  }
};
