const REPLACEMENTS: Array<[RegExp, string]> = [
  // Curly quotes → straight quotes
  [/[\u201C\u201D]/g, '"'],
  [/[\u2018\u2019]/g, "'"],
  // Dashes/ellipsis → ASCII
  [/\u2014/g, '-'], // em dash
  [/\u2013/g, '-'], // en dash
  [/\u2026/g, '...'], // ellipsis
  // Bullets and common UI glyphs → plain text equivalents
  [/[•‣◦∙]/g, '-'],
  [/→/g, '->'],
  [/⇒/g, '->'],
  [/✓/g, ''], // checkmark (usually noise in a chat reply)
  // Invisible/formatting characters that sometimes leak from models
  [/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ''],
];

const UNCOMMON_SYMBOLS = /[§¶†‡※]/g;

export function sanitizeHumanReply(text: string): string {
  if (!text) return text;

  let next = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }

  next = next.replace(UNCOMMON_SYMBOLS, '');

  // Normalize whitespace around newlines without destroying formatting.
  next = next.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
  next = next.replace(/[ \t]{2,}/g, ' ');

  return next.trim();
}

