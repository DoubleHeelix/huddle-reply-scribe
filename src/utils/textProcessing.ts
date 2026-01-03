const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const applyInlineMarkdown = (value: string): string => {
  let html = escapeHtml(value);

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic (single * or _)
  html = html.replace(/(^|[^\*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>');

  return html;
};

export const formatExtractedText = (text: string): string => {
  if (!text) return '';

  let cleanedText = text;

  // Replace common typographic ligatures
  const ligatures: Record<string, string> = {
    'ﬁ': 'fi',
    'ﬂ': 'fl',
    'ﬀ': 'ff',
    'ﬃ': 'ffi',
    'ﬄ': 'ffl',
    'ﬅ': 'ft',
    'ﬆ': 'st',
  };

  for (const ligature in ligatures) {
    cleanedText = cleanedText.replace(new RegExp(ligature, 'g'), ligatures[ligature]);
  }

  // Remove a wide range of symbols, emojis, and non-standard characters
  cleanedText = cleanedText
    .replace(/[\u25A0-\u25FF\u2022\u2013\uFFFD]/gu, ' ')
    .replace(/\p{Extended_Pictographic}/gu, ' ');

  // Normalize whitespace per line but keep markdown-friendly line structure
  cleanedText = cleanedText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleanedText;
};

export const renderMarkdownToHtml = (text: string): string => {
  if (!text) return '';

  const lines = formatExtractedText(text).split('\n');
  const htmlParts: string[] = [];

  let inUnorderedList = false;
  let inOrderedList = false;

  const closeLists = () => {
    if (inUnorderedList) {
      htmlParts.push('</ul>');
      inUnorderedList = false;
    }
    if (inOrderedList) {
      htmlParts.push('</ol>');
      inOrderedList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeLists();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      const content = applyInlineMarkdown(headingMatch[2]);
      htmlParts.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inOrderedList) {
        closeLists();
        htmlParts.push('<ol class="list-decimal pl-5 space-y-1">');
        inOrderedList = true;
      }
      htmlParts.push(`<li>${applyInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    const unorderedMatch = line.match(/^-+\s+(.*)$/);
    if (unorderedMatch) {
      if (!inUnorderedList) {
        closeLists();
        htmlParts.push('<ul class="list-disc pl-5 space-y-1">');
        inUnorderedList = true;
      }
      htmlParts.push(`<li>${applyInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    closeLists();
    htmlParts.push(`<p>${applyInlineMarkdown(line)}</p>`);
  }

  closeLists();
  return htmlParts.join('\n');
};
