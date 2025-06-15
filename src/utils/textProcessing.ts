
export const cleanReply = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleanedText = text.trim();
  
  // Remove excessive newlines
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  
  // Remove leading whitespace from each line
  cleanedText = cleanedText.replace(/^[ \t]+/gm, '');
  
  // Phrases to remove from the beginning
  const phrasesToRemove = [
    'This is a draft', 'Draft:', 'Suggested reply:', 
    'Here is your response:', 'Rewritten Message:', 'Okay, here\'s a draft:',
    'Here\'s a revised version:', 'Here\'s a suggestion for your reply:',
    'Sure, here\'s a reply you could use:', 'Here\'s a possible response:',
    'Here is a draft for your reply:', 'Response:', 'Message:',
    'Reply:'
  ];
  
  for (const phrase of phrasesToRemove) {
    if (cleanedText.toLowerCase().startsWith(phrase.toLowerCase())) {
      cleanedText = cleanedText.slice(phrase.length).replace(/^[:\s]+/, '');
      break;
    }
  }
  
  return cleanedText.trim();
};

export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim();
};
