export type StyleFingerprint = {
  emoji_rate_per_message?: number;
  emoji_message_share?: number;
  exclamation_per_sentence?: number;
  question_per_sentence?: number;
  uppercase_word_ratio?: number;
  typical_word_count?: number;
  typical_char_count?: number;
  slang_examples?: string[];
  greetings?: string[];
  closings?: string[];
};

export type StylePhrases = {
  bigrams: string[];
  trigrams: string[];
};

export type PersonalStyleProfile = {
  occupation: string;
  hobbies: string;
  location: string;
  fun_fact: string;
};

export type StyleProfile = {
  id?: string;
  user_id?: string;
  updated_at?: string;
  huddle_count: number;
  avg_sentence_length: number;
  formality: string;
  sentiment: string;
  common_topics: string[];
  common_phrases: StylePhrases;
  common_sentences: string[];
  style_fingerprint: StyleFingerprint;
  personal_profile: PersonalStyleProfile;
};

export type StyleProfileStrength = {
  score: number;
  label: "Learning" | "Established" | "Strong";
};

export type AppliedStyleProfile = {
  applied: boolean;
  huddleCount?: number;
  formality?: string;
  sentiment?: string;
  typicalWordCount?: number;
  signaturePhrases?: string[];
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const blockedStyleTokens = new Set([
  "available",
  "document",
  "explicit",
  "generate",
  "generated",
  "huddle",
  "huddles",
  "screenshot",
]);

const blockedTopicTokens = new Set([
  ...blockedStyleTokens,
  "best",
  "bro",
  "get",
  "good",
  "haha",
  "im",
  "ive",
  "man",
  "much",
  "past",
  "thats",
  "using",
  "yeah",
]);

const blockedStyleFragments = [
  "no explicit draft provided",
  "generate the best possible reply",
  "match the user's usual style",
  "match the user’s usual style",
  "screenshot context",
  "document knowledge",
  "past huddles",
  "plus any available",
];

export const isUsefulStyleSignal = (value: string): boolean => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (blockedStyleTokens.has(normalized)) return false;
  return !blockedStyleFragments.some((fragment) =>
    normalized.includes(fragment),
  );
};

export const isUsefulStyleTopic = (value: string): boolean => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return isUsefulStyleSignal(value) && !blockedTopicTokens.has(normalized);
};

export const emptyStyleProfile = (): StyleProfile => ({
  huddle_count: 0,
  avg_sentence_length: 0,
  formality: "balanced",
  sentiment: "warm",
  common_topics: [],
  common_phrases: {
    bigrams: [],
    trigrams: [],
  },
  common_sentences: [],
  style_fingerprint: {},
  personal_profile: {
    occupation: "",
    hobbies: "",
    location: "",
    fun_fact: "",
  },
});

export const parseStyleProfile = (value: unknown): StyleProfile => {
  const row = asRecord(value);
  const phrases = asRecord(row.common_phrases);
  const fingerprint = asRecord(row.style_fingerprint);
  const personal = asRecord(row.personal_profile);

  return {
    id: asString(row.id) || undefined,
    user_id: asString(row.user_id) || undefined,
    updated_at: asString(row.updated_at) || undefined,
    huddle_count: asNumber(row.huddle_count),
    avg_sentence_length: asNumber(row.avg_sentence_length),
    formality: asString(row.formality) || "balanced",
    sentiment: asString(row.sentiment) || "warm",
    common_topics: asStringArray(row.common_topics)
      .filter(isUsefulStyleTopic)
      .slice(0, 16),
    common_phrases: {
      bigrams: asStringArray(phrases.bigrams)
        .filter(isUsefulStyleSignal)
        .slice(0, 10),
      trigrams: asStringArray(phrases.trigrams)
        .filter(isUsefulStyleSignal)
        .slice(0, 10),
    },
    common_sentences: asStringArray(row.common_sentences)
      .filter(isUsefulStyleSignal)
      .slice(0, 8),
    style_fingerprint: {
      emoji_rate_per_message: asNumber(fingerprint.emoji_rate_per_message),
      emoji_message_share: asNumber(fingerprint.emoji_message_share),
      exclamation_per_sentence: asNumber(
        fingerprint.exclamation_per_sentence,
      ),
      question_per_sentence: asNumber(fingerprint.question_per_sentence),
      uppercase_word_ratio: asNumber(fingerprint.uppercase_word_ratio),
      typical_word_count: asNumber(fingerprint.typical_word_count),
      typical_char_count: asNumber(fingerprint.typical_char_count),
      slang_examples: asStringArray(fingerprint.slang_examples),
      greetings: asStringArray(fingerprint.greetings),
      closings: asStringArray(fingerprint.closings),
    },
    personal_profile: {
      occupation: asString(personal.occupation),
      hobbies: asString(personal.hobbies),
      location: asString(personal.location),
      fun_fact: asString(personal.fun_fact),
    },
  };
};

export const getStyleProfileStrength = (
  profile: StyleProfile | null,
): StyleProfileStrength => {
  if (!profile) return { score: 0, label: "Learning" };

  const phraseCount =
    profile.common_phrases.bigrams.length +
    profile.common_phrases.trigrams.length;
  const fingerprintSignals = [
    profile.style_fingerprint.typical_word_count,
    profile.style_fingerprint.emoji_message_share,
    profile.style_fingerprint.question_per_sentence,
    profile.style_fingerprint.slang_examples?.length,
    profile.style_fingerprint.greetings?.length,
    profile.style_fingerprint.closings?.length,
  ].filter((value) => typeof value === "number" && value > 0).length;
  const personalSignals = Object.values(profile.personal_profile).filter(
    Boolean,
  ).length;

  const score = Math.min(
    100,
    Math.round(
      Math.min(25, profile.huddle_count * 1.25) +
        Math.min(15, profile.common_topics.length * 2.5) +
        Math.min(20, phraseCount * 3) +
        Math.min(25, fingerprintSignals * 5) +
        Math.min(15, personalSignals * 3.75),
    ),
  );

  return {
    score,
    label: score >= 70 ? "Strong" : score >= 35 ? "Established" : "Learning",
  };
};

export const getStyleProfileSignals = (
  profile: StyleProfile | null,
): string[] => {
  if (!profile) return [];

  const signals: string[] = [];
  const formalityLabel =
    profile.formality === "balanced" ? "Natural" : profile.formality;
  if (formalityLabel) {
    signals.push(
      `${formalityLabel[0].toUpperCase()}${formalityLabel.slice(1)} tone`,
    );
  }
  if (profile.sentiment) {
    signals.push(
      `${profile.sentiment[0].toUpperCase()}${profile.sentiment.slice(1)} feel`,
    );
  }
  if (profile.style_fingerprint.typical_word_count) {
    signals.push(`~${profile.style_fingerprint.typical_word_count} words`);
  }
  const slang = profile.style_fingerprint.slang_examples?.[0];
  if (slang) signals.push(`natural “${slang}”`);
  return signals.slice(0, 4);
};
