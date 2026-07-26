import { supabase } from "@/integrations/supabase/client";
import type { AppliedStyleProfile } from "@/types/styleProfile";
import type { DraftInputMode } from "@/utils/draftInput";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export type HuddleGenerationMeta = {
  huddleId?: string;
  generationId?: string;
  generationModel?: string;
  modelRoute?: string;
  pastHuddles: unknown[];
  documentKnowledge: unknown[];
  slangAddressTerms?: string[];
  styleProfile?: AppliedStyleProfile;
};

type HuddleStreamEvent =
  | ({ type: "meta" } & Partial<HuddleGenerationMeta>)
  | { type: "token"; text?: string }
  | { type: "done" };

export type HuddleGenerationRequest = {
  screenshotText: string;
  userDraft: string;
  draftInputMode: DraftInputMode;
  isRegeneration: boolean;
  requestId: string;
  huddleId?: string;
  parentGenerationId?: string;
};

export class HuddleGenerationHttpError extends Error {
  constructor(
    public readonly status: number,
    message = `Generation request failed (${status})`,
  ) {
    super(message.includes(String(status)) ? message : `${message} (${status})`);
    this.name = "HuddleGenerationHttpError";
  }
}

function parseEvent(line: string): HuddleStreamEvent | null {
  if (!line.trim()) return null;
  const parsed = JSON.parse(line) as HuddleStreamEvent;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !["meta", "token", "done"].includes(parsed.type)
  ) {
    throw new Error("Unsupported generation stream event");
  }
  return parsed;
}

export async function streamHuddleReply(
  request: HuddleGenerationRequest,
  handlers: {
    onToken?: (reply: string, meta: HuddleGenerationMeta) => void;
    onMeta?: (meta: HuddleGenerationMeta) => void;
  } = {},
): Promise<{ reply: string; meta: HuddleGenerationMeta }> {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new HuddleGenerationHttpError(401, "Authentication required");
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/enhanced-ai-suggestions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "generateReply",
        ...request,
        returnLightweight: true,
      }),
    },
  );

  if (!response.ok || !response.body) {
    const payload = await response
      .json()
      .catch(() => null) as { error?: unknown } | null;
    const message =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error
        : `Generation request failed (${response.status})`;
    throw new HuddleGenerationHttpError(response.status, message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let reply = "";
  let sawDone = false;
  let meta: HuddleGenerationMeta = {
    pastHuddles: [],
    documentKnowledge: [],
  };

  const processLine = (line: string) => {
    let event: HuddleStreamEvent | null;
    try {
      event = parseEvent(line);
    } catch (error) {
      console.error("Unable to parse generation stream event", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return;
    }
    if (!event) return;

    if (event.type === "meta") {
      meta = {
        ...meta,
        ...event,
        pastHuddles: Array.isArray(event.pastHuddles)
          ? event.pastHuddles
          : meta.pastHuddles,
        documentKnowledge: Array.isArray(event.documentKnowledge)
          ? event.documentKnowledge
          : meta.documentKnowledge,
      };
      handlers.onMeta?.(meta);
      return;
    }

    if (event.type === "token") {
      reply += typeof event.text === "string" ? event.text : "";
      handlers.onToken?.(reply, meta);
      return;
    }

    sawDone = true;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(processLine);
  }
  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);

  if (!sawDone) {
    throw new Error("Generation stream ended before completion");
  }

  return { reply, meta };
}
