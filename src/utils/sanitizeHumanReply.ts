// Normalize AI output to feel human-written: strip control chars/odd symbols, normalize whitespace,
// and replace uncommon punctuation with simple ASCII equivalents.
export function sanitizeHumanReply(input: string): string {
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

  // Remove zero-width and control characters.
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

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
