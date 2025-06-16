export interface HuddlePlay {
  id: string;
  created_at: string;
  screenshot_text: string;
  user_draft: string;
  generated_reply: string;
  final_reply?: string;
  selected_tone?: string;
}

export const getCategory = (huddle: HuddlePlay): string => {
  const text = [
    huddle.screenshot_text,
    huddle.user_draft,
    huddle.generated_reply,
    huddle.final_reply,
  ]
    .join(' ')
    .toLowerCase();

  if (
    ["what's the business", 'what is it', 'what do you do', 'side hustle', 'what is this'].some(
      (keyword) => text.includes(keyword)
    )
  ) {
    return "💼 What's the business?";
  }
  if (
    ['property', 'shares', 'trading', 'dropshipping', 'like...?'].some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return '🤔 Is it like...?';
  }
  if (
    ['make money', 'how much', 'charge', 'income', 'revenue', 'profit'].some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return '💰 How do you make money?';
  }
  if (['mentor', 'mentors', 'mentorship', 'coach', 'coaching'].some((keyword) => text.includes(keyword))) {
    return '👥 Who are your mentors?';
  }
  if (
    ['get connected', 'get involved', 'how did you get in', 'how do i join', 'selection process'].some(
      (keyword) => text.includes(keyword)
    )
  ) {
    return '🤝 How do I get involved?';
  }
  if (['pyramid scheme', 'ponzi'].some((keyword) => text.includes(keyword))) {
    return '⚠️ Is it a pyramid scheme?';
  }
  if (
    ['skincare', 'energy drinks', 'makeup', 'products', 'selling', 'sell'].some((keyword) =>
      text.includes(keyword)
    )
  ) {
    return '💄 Product-related questions';
  }
  return '💬 General';
};