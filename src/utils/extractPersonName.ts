const MIN_CONFIDENCE_SCORE = 5;

// Pull a likely person name/handle out of the OCR text using platform-specific cues,
// frequency, and simple shape checks (human name or @handle). Falls back to Unknown
// when confidence is low so users can correct it safely.
export const extractPersonName = (text: string | null | undefined): string => {
  if (!text) return 'Unknown';

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const stopWords = new Set([
    'you',
    'me',
    'today',
    'yesterday',
    'delivered',
    'seen',
    'typing',
    'active',
    'search',
    'inbox',
    'message',
    'messages',
    'chats',
    'reply',
    'forwarded',
    'deleted',
    'instagram',
    'insta',
    'ig',
    'unread',
    'story',
    'wear',
    'followers',
    'following',
    'notes',
    'requests',
  ]);

  const rejectSingles = new Set([
    'what',
    'how',
    'hows',
    'oh',
    'nah',
    'im',
    "i'm",
    'thats',
    "that's",
    'replied',
    'reply',
    'unread',
    'story',
    'wear',
  ]);

  const timestampLike = (value: string) =>
    /(am|pm|AM|PM|\d{1,2}:\d{2}|Yesterday|Today)/.test(value);

  const cleanCandidate = (raw: string) =>
    raw.replace(/^[^A-Za-z@]+|[^A-Za-z0-9@._'-]+$/g, '').trim();

  const looksLikeHandle = (value: string) =>
    /^@?[A-Za-z][A-Za-z0-9._]{3,29}$/.test(value) && /[A-Za-z]{3,}/.test(value);

  const looksLikeName = (value: string) => {
    const parts = value.split(/\s+/);
    if (parts.length === 0 || parts.length > 4) return false;
    if (value.length < 2 || value.length > 40) return false;
    return parts.every((part) => /^[A-Z][a-zA-Z'’-]*$/.test(part) || /^[A-Z]{2,}$/.test(part));
  };

  const scoreMap = new Map<string, number>();
  const addCandidate = (raw: string, weight: number) => {
    const candidate = cleanCandidate(raw);
    if (!candidate) return;
    const lower = candidate.toLowerCase();
    if (stopWords.has(lower) || rejectSingles.has(lower)) return;
    if (candidate.startsWith('To ')) return; // avoid chat headers like "To Catch"
    if (!(looksLikeHandle(candidate) || looksLikeName(candidate))) return;
    const wordBonus = candidate.trim().split(/\s+/).length > 1 ? 1 : 0;
    scoreMap.set(candidate, (scoreMap.get(candidate) || 0) + weight + wordBonus);
  };

  const addHandleWithNeighborName = (line: string, weight: number) => {
    // Capture patterns like "Ryan Couronne @ryancouronne" or "Ryan Couronne ryancouronne"
    const nameThenHandle = line.match(
      /([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){0,2})\s+(@?[A-Za-z][\w.]{3,29})/
    );
    if (nameThenHandle) {
      addCandidate(nameThenHandle[1], weight + 2);
      addCandidate(nameThenHandle[2], weight);
    }
  };

  const addInstagramHeaderSignals = (headerLines: string[]) => {
    const statusRegex = /(active|followers|following|message request|requests|notes|muted|notifications)/i;
    headerLines.forEach((line, idx) => {
      const dotParts = line.split('·').map((p) => p.trim());
      if (dotParts.length > 1 && looksLikeHandle(dotParts[0])) {
        addCandidate(dotParts[0], 6);
      }
      const handleBeforeStatus = line.match(
        /^(@?[A-Za-z][\w.]{3,30})\s+(?:·\s*)?(Active|Followers|Following|Message Request|Requests|Notes)/i
      );
      if (handleBeforeStatus) {
        addCandidate(handleBeforeStatus[1], 7);
      }
      if (statusRegex.test(line)) {
        const prev = headerLines[idx - 1];
        if (prev) addCandidate(prev, 7);
        if (dotParts.length > 1) {
          addCandidate(dotParts[0], 6);
        }
      }
    });
  };

  const addMessengerHeaderSignals = (headerLines: string[]) => {
    const statusRegex = /(active now|active \d+\s*(?:m|h|hours?|mins?) ago|active today|active yesterday)/i;
    headerLines.forEach((line, idx) => {
      const dotParts = line.split('·').map((p) => p.trim());
      const nameBeforeStatus = line.match(
        /^([A-Z][\w.'’ -]{2,50})\s+(?:·\s*)?(Active now|Active \d+\s*(?:m|h|hours?|mins?) ago|Active today|Active yesterday)/i
      );
      if (nameBeforeStatus) {
        addCandidate(nameBeforeStatus[1], 7);
      }
      if (statusRegex.test(line)) {
        const prev = headerLines[idx - 1];
        if (prev) addCandidate(prev, 7);
        if (dotParts.length > 1) {
          addCandidate(dotParts[0], 6);
        }
      }
      const matchedOn = line.match(/^You matched on/i);
      const friendsOn = line.match(/^You (?:are|were) friends on/i);
      if ((matchedOn || friendsOn) && idx > 0) {
        addCandidate(headerLines[idx - 1], 6);
      }
    });
  };

  const limitedLines = lines.slice(0, 15);
  addInstagramHeaderSignals(limitedLines.slice(0, 8));
  addMessengerHeaderSignals(limitedLines.slice(0, 8));

  const arrowTokens = ['<-', '->', '→', '←'];
  const brandRegex = /(instagram|insta|ig)\s+([A-Z@][\w.'’_-]{2,30}(?:\s+[A-Z@][\w.'’_-]{1,30}){0,2})/i;
  const arrowNameRegex = /([A-Z@][\w.'’_-]{2,30}(?:\s+[A-Z@][\w.'’_-]{1,30}){0,2})/;
  const namePhraseRegex = /([A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){1,2})/g;

  // Handles and colon-prefixed senders.
  limitedLines.forEach((line, idx) => {
    const handleMatch = line.match(/@[\w.]{3,25}/g);
    if (handleMatch) {
      handleMatch.forEach((h) => addCandidate(h, 3));
    }
    addHandleWithNeighborName(line, 4);

    const brandMatch = line.match(brandRegex);
    if (brandMatch && brandMatch[2]) {
      addCandidate(brandMatch[2], 5);
    }

    const phraseMatches = line.match(namePhraseRegex);
    if (phraseMatches) {
      phraseMatches.forEach((m) => addCandidate(m, 5));
    }

    const arrowToken = arrowTokens.find((t) => line.includes(t));
    if (arrowToken) {
      const parts = line.split(arrowToken);
      if (parts[0]) addHandleWithNeighborName(parts[0], 3);
      if (parts[1]) addHandleWithNeighborName(parts[1], 4); // weight the "other side" higher
      parts.forEach((p, i) => addCandidate(p, 2 + i)); // right side slightly higher

      // If there's text after the arrow that looks like a name, reward it strongly.
      if (parts[1]) {
        const nameMatch = parts[1].match(arrowNameRegex);
        if (nameMatch && nameMatch[1]) addCandidate(nameMatch[1], 6);
      }
    }

    if (line.includes(':')) {
      addCandidate(line.split(':')[0], 3);
    }
    // Header right above a timestamp line.
    if (timestampLike(line) && idx > 0) {
      addCandidate(limitedLines[idx - 1], 4);
    }
  });

  // Capitalized chunks anywhere early in the text.
  limitedLines.forEach((line) => {
    const words = line.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      addCandidate(words.slice(i, i + 3).join(' '), 1);
    }
  });

  // Frequency-based fallback across the whole text: collect single/bigram capitalized tokens.
  const allWords = text.split(/\s+/);
  for (let i = 0; i < allWords.length; i++) {
    const w1 = cleanCandidate(allWords[i]);
    const w2 = cleanCandidate(allWords[i + 1] || '');

    if (w1 && /^[A-Z][a-zA-Z'’.-]{2,}$/.test(w1) && !stopWords.has(w1.toLowerCase())) {
      addCandidate(w1, 1);
    }

    if (
      w1 &&
      w2 &&
      /^[A-Z][a-zA-Z'’.-]{2,}$/.test(w1) &&
      /^[A-Z][a-zA-Z'’.-]{2,}$/.test(w2) &&
      !stopWords.has(w1.toLowerCase()) &&
      !stopWords.has(w2.toLowerCase())
    ) {
      addCandidate(`${w1} ${w2}`, 2);
      // Slightly reward the individual parts too
      addCandidate(w1, 1);
      addCandidate(w2, 1);
    }
  }

  if (scoreMap.size > 0) {
    const ranked = Array.from(scoreMap.entries())
      .filter(([cand]) => {
        const lower = cand.toLowerCase();
        return !rejectSingles.has(lower) && cand.length >= 3;
      })
      .map(([cand, baseScore]) => {
        const parts = cand.trim().split(/\s+/).length;
        const multiWordBonus = parts >= 2 ? 1 : 0;
        return { cand, score: baseScore + multiWordBonus, parts, length: cand.length };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.parts !== a.parts) return b.parts - a.parts; // prefer multi-word names
        return b.length - a.length;
      });

    if (ranked.length > 0) {
      const best = ranked[0];
      const bestMulti = ranked.find((r) => r.parts >= 2 && r.score >= best.score - 1);
      const chosen = bestMulti || best;
      if (chosen.score >= MIN_CONFIDENCE_SCORE) {
        return chosen.cand;
      }
    }
  }

  const fallback = cleanCandidate(lines[0] || '');
  if ((looksLikeHandle(fallback) || looksLikeName(fallback)) && fallback.length >= 3) {
    return fallback;
  }
  return 'Unknown';
};
