export const formatExtractedText = (text: string): string => {
  if (!text) return "";

  let cleanedText = text;

  // 1. Replace common typographic ligatures
  const ligatures: { [key: string]: string } = {
    'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
    'ﬅ': 'ft', 'ﬆ': 'st'
  };
  for (const ligature in ligatures) {
    cleanedText = cleanedText.replace(new RegExp(ligature, 'g'), ligatures[ligature]);
  }

  // 2. Remove a wide range of symbols, emojis, and non-standard characters
  // This regex targets many common visual artifacts from PDFs and unicode symbols.
  cleanedText = cleanedText.replace(/[\u25A0-\u25FF\u2022\u2013\uFFFD\uD83C-\uDBFF\uDC00-\uDFFF]/g, ' ');

  // 3. Normalize whitespace and remove leading/trailing whitespace from lines
  cleanedText = cleanedText.split('\n').map(line => line.trim()).join('\n');
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  // 4. Add proper line breaks for paragraph structure
  // This regex adds a newline after a sentence-ending punctuation mark followed by a space and an uppercase letter.
  cleanedText = cleanedText.replace(/([.?!])\s+(?=[A-Z])/g, '$1\n\n');

  return cleanedText;
};
