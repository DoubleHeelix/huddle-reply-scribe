import { encode } from "gpt-tokenizer";

export type MarkerChunk = {
  markerIndex: number; // the X in --- CHUNK X ---
  content: string; // cleaned markdown content for that marker chunk
};

// Match marker anywhere (inline or full line): --- CHUNK 1 ---
const CHUNK_MARKER_ANYWHERE_REGEX = /---\s*CHUNK\s*(\d+)\s*---/gi;

// Standalone page numbers (PDF artifacts like "1", "2", "3", "4")
const STANDALONE_PAGE_NUMBER_REGEX = /^\s*\d+\s*$/;

// Treat only true bullet glyphs as bullets (not conversational emojis)
const BULLET_LEAD_REGEX = /^\s*(?:[-*]|[•●▪◦・·‣∙‧○◎])\s+/;

const HEADING_LINE_REGEX = /^#{1,6}\s+/;
const NUMBERED_LINE_REGEX = /^\s*\d+\.\s+/;

// Mid-line markdown tokens that should start on new lines if extractor collapses them
const HEADING_MIDLINE_REGEX = /(\s)(#{1,6}\s+)/g;
const NUMBERED_MIDLINE_REGEX = /(\s)(\d+\.\s+)/g;
const DASH_BULLET_MIDLINE_REGEX = /(\s)(-\s+)/g;

/**
 * Normalize extracted text into markdown-friendly form.
 * IMPORTANT: This function is intended to run AFTER marker splitting.
 * It strips any remaining inline markers, removes page numbers, normalizes bullets,
 * joins wrapped list lines, and re-lines headings/lists if needed.
 */
export function preprocessToMarkdown(text: string): string {
  // Remove any inline markers left behind (after split)
  const lf = text
    .replace(/\r\n/g, "\n")
    .replace(/---\s*CHUNK\s*\d+\s*---/gi, "")
    .trim();

  const lines = lf.split("\n");

  // 1) Remove standalone page numbers; normalize bullets
  const normalizedLines: string[] = [];
  for (const rawLine of lines) {
    // Remove standalone page numbers
    if (STANDALONE_PAGE_NUMBER_REGEX.test(rawLine)) continue;

    let line = rawLine.trimEnd();

    // Normalize leading bullet glyphs to "- "
    if (BULLET_LEAD_REGEX.test(line)) {
      line = line.replace(BULLET_LEAD_REGEX, "- ");
    }

    normalizedLines.push(line);
  }

  // 2) Join wrapped list item continuations
  const joined: string[] = [];
  const isHeadingLine = (s: string) => HEADING_LINE_REGEX.test(s.trim());
  const isBulletLine = (s: string) => s.trim().startsWith("- ");
  const isNumberedLine = (s: string) => NUMBERED_LINE_REGEX.test(s.trim());

  for (const line of normalizedLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      joined.push("");
      continue;
    }

    const prev = joined[joined.length - 1] ?? "";
    const prevTrim = prev.trim();

    const prevIsList =
      prevTrim.startsWith("- ") || NUMBERED_LINE_REGEX.test(prevTrim);

    const currIsNewBlock =
      isHeadingLine(trimmed) ||
      isBulletLine(trimmed) ||
      isNumberedLine(trimmed);

    // If previous line is a list item and this line is not a new heading/list item,
    // treat as a wrapped continuation.
    if (prevIsList && !currIsNewBlock) {
      joined[joined.length - 1] = `${prevTrim} ${trimmed}`;
      continue;
    }

    joined.push(line.trimEnd());
  }

  // 3) Collapse excessive blank lines
  const collapsed = joined
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 4) Force mid-line markdown tokens onto new lines
  const relined = collapsed
    .replace(HEADING_MIDLINE_REGEX, "\n$2")
    .replace(NUMBERED_MIDLINE_REGEX, "\n$2")
    .replace(DASH_BULLET_MIDLINE_REGEX, "\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return relined;
}

/**
 * Split raw extracted text by markers even when markers are inline:
 * - Works for:
 *   --- CHUNK 1 ---
 *   --- CHUNK 1 --- # Title
 *
 * Returns ONLY the content after each marker, up to the next marker.
 */
export function splitByChunkMarkers(
  rawText: string
): Array<{ markerIndex: number; rawContent: string }> {
  const text = rawText.replace(/\r\n/g, "\n");

  const matches: Array<{ markerIndex: number; start: number; end: number }> =
    [];
  for (const m of text.matchAll(CHUNK_MARKER_ANYWHERE_REGEX)) {
    const markerIndex = Number(m[1]);
    if (!Number.isFinite(markerIndex)) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    matches.push({ markerIndex, start, end });
  }

  // If no markers found, return one chunk as fallback
  if (matches.length === 0) {
    return [{ markerIndex: 1, rawContent: text.trim() }];
  }

  const out: Array<{ markerIndex: number; rawContent: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextStart =
      i + 1 < matches.length ? matches[i + 1].start : text.length;

    // Content begins immediately after marker, including same-line content
    const rawContent = text.slice(current.end, nextStart).trim();
    if (rawContent) out.push({ markerIndex: current.markerIndex, rawContent });
  }

  return out;
}

/**
 * STRICT MODE:
 * - Exactly 1 upload row per marker chunk
 * - No token splitting, no overlap, no subchunking
 */
export function markerChunksToUploadStrict(rawText: string): MarkerChunk[] {
  const markerChunks = splitByChunkMarkers(rawText);

  return markerChunks.map((mc) => ({
    markerIndex: mc.markerIndex,
    content: preprocessToMarkdown(mc.rawContent),
  }));
}

// Utility (debug / metadata)
export function tokenCount(text: string): number {
  return encode(text).length;
}
