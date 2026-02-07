// Normalize AI output to feel human-written: strip control chars/odd symbols, normalize whitespace,
// and replace uncommon punctuation with simple ASCII equivalents.
const defaultSlangAddressTerms = [
  "bro",
  "broo",
  "brooo",
  "man",
  "dude",
  "fam",
  "yall",
  "y'all",
];

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSlangTerms = (terms: string[]) =>
  Array.from(
    new Set(
      terms
        .map((term) => term.trim().toLowerCase())
        .filter((term) => term.length >= 2)
    )
  );

const buildSlangAddressRegex = (terms: string[]) => {
  const normalized = normalizeSlangTerms(terms);
  if (!normalized.length) return null;
  const escaped = normalized.map(escapeRegex).join("|");
  return new RegExp(`,\\s+(${escaped})(?=$|\\s|[.!?])`, "gi");
};

const defaultSlangAddressRegex = buildSlangAddressRegex(defaultSlangAddressTerms);

type SanitizeOptions = {
  slangAddressTerms?: string[];
};

const stripControlChars = (value: string) =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return !((code >= 0 && code <= 31) || (code >= 127 && code <= 159));
    })
    .join("");

export function sanitizeHumanReply(
  input: string,
  options: SanitizeOptions = {}
): string {
  if (!input) return "";

  let text = input;

  // Replace some common oddities with simpler equivalents (no dashes/hyphens).
  text = text
    .replace(/[\u2012-\u2015]/g, " ") // en/em/figure dashes to space
    .replace(/-/g, " ") // ASCII hyphen to space
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes to straight
    .replace(/[\u201C\u201D]/g, '"') // curly double quotes to straight
    .replace(/\u00A0/g, " "); // non-breaking space to space

  // Avoid adding a vocative comma before casual address terms.
  const slangRegex = options.slangAddressTerms?.length
    ? buildSlangAddressRegex([
        ...defaultSlangAddressTerms,
        ...options.slangAddressTerms,
      ])
    : defaultSlangAddressRegex;
  if (slangRegex) {
    text = text.replace(slangRegex, " $1");
  }

  // Remove zero-width and control characters.
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  text = stripControlChars(text);

  // Drop unusual symbols outside typical letters/numbers/punctuation/spaces/newlines/emoji.
  text = text.replace(
    /[^\p{L}\p{N}\p{P}\p{Zs}\n\r\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
    ""
  );

  // Normalize whitespace (collapse runs of spaces/tabs, trim, limit blank lines).
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export default sanitizeHumanReply;
