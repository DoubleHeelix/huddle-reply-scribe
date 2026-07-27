const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSlangAddressRegex = (terms: string[]): RegExp | null => {
  if (!terms.length) return null;
  const escaped = terms.map(escapeRegex).join("|");
  return new RegExp(`,\\s+(${escaped})(?=$|\\s|[.!?])`, "gi");
};

const removeVocativeComma = (text: string, terms: string[] = []): string => {
  const regex = buildSlangAddressRegex(terms);
  return regex ? text.replace(regex, " $1") : text;
};

const stripUnsafeControlChars = (value: string): string =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      // Preserve tabs, LF, and CR so whitespace normalization can retain layout.
      if (code === 9 || code === 10 || code === 13) return true;
      return !((code >= 0 && code <= 31) || (code >= 127 && code <= 159));
    })
    .join("");

export function sanitizeReply(
  text: string,
  options: { trim?: boolean; slangAddressTerms?: string[] } = {},
): string {
  if (!text) return "";

  let cleaned = stripUnsafeControlChars(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/gu, " ")
    .replace(
      /[^\p{L}\p{N}\p{P}\p{Zs}\n\r\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
      " ",
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  if (options.slangAddressTerms?.length) {
    cleaned = removeVocativeComma(cleaned, options.slangAddressTerms);
  }

  return options.trim ? cleaned.trim() : cleaned;
}
