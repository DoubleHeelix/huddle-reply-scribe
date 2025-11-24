import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCcw, Users, MessageCircle, Calendar, Search } from 'lucide-react';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { formatDistanceToNow } from 'date-fns';
import type { HuddlePlay } from '@/utils/huddlePlayService';

const isWhatsAppText = (text: string | null | undefined): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('whatsapp') ||
    lower.includes('end-to-end encrypted') ||
    lower.includes('type a message') ||
    lower.includes('typing…') ||
    lower.includes('online') ||
    lower.includes('status') ||
    lower.includes('calls') ||
    lower.includes('chats')
  );
};

// Pull a likely person name/handle out of the OCR text using header/timestamp/colon/arrow cues,
// frequency, and simple shape checks (human name or @handle). Falls back to Unknown.
const extractPersonName = (text: string | null | undefined): string => {
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
    'uber',
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

  const limitedLines = lines.slice(0, 15);
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
      return (bestMulti || best).cand;
    }
  }

  const fallback = cleanCandidate(lines[0] || '');
  if (looksLikeHandle(fallback) || looksLikeName(fallback)) return fallback;
  return fallback || 'Unknown';
};

interface PersonGroup {
  name: string;
  huddles: HuddlePlay[];
  lastInteraction: number;
  rawNames: Set<string>;
}

export const PeopleTab = () => {
  const { huddlePlays, isLoading, error, refetch } = useHuddlePlays();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showInfo, setShowInfo] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load overrides from localStorage and persist changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('people_overrides');
    if (stored) {
      try {
        setOverrides(JSON.parse(stored));
      } catch {
        setOverrides({});
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('people_overrides', JSON.stringify(overrides));
  }, [overrides]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem('people_info_dismissed');
    if (dismissed === 'true') {
      setShowInfo(false);
    }
  }, []);

  const dismissInfo = () => {
    setShowInfo(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('people_info_dismissed', 'true');
    }
  };

  const applyOverride = useCallback(
    (rawName: string) => overrides[rawName] || rawName,
    [overrides]
  );

  const saveRename = (group: PersonGroup, newNameRaw: string) => {
    const newName = newNameRaw.trim();
    if (!newName) return;
    setOverrides((prev) => {
      const next = { ...prev };
      group.rawNames.forEach((raw) => {
        next[raw] = newName;
      });
      return next;
    });
    setRenameDrafts((prev) => {
      const next = { ...prev };
      delete next[group.name];
      return next;
    });
  };

  const filteredPlays = useMemo(
    () => huddlePlays.filter((h) => !isWhatsAppText(h.screenshot_text)),
    [huddlePlays]
  );

  const groupedByPerson = useMemo<PersonGroup[]>(() => {
    const groups = new Map<string, PersonGroup>();

    filteredPlays.forEach((huddle) => {
      const rawName = extractPersonName(huddle.screenshot_text);
      const name = applyOverride(rawName);
      const existing = groups.get(name);
      const createdAt = new Date(huddle.created_at).getTime();

      if (existing) {
        existing.huddles.push(huddle);
        existing.lastInteraction = Math.max(existing.lastInteraction, createdAt);
        existing.rawNames.add(rawName);
      } else {
        groups.set(name, {
          name,
          huddles: [huddle],
          lastInteraction: createdAt,
          rawNames: new Set([rawName]),
        });
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => b.lastInteraction - a.lastInteraction
    );
  }, [applyOverride, filteredPlays]);

  const visibleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupedByPerson;
    return groupedByPerson.filter((group) => {
      if (group.name.toLowerCase().includes(q)) return true;
      return Array.from(group.rawNames).some((raw) => raw.toLowerCase().includes(q));
    });
  }, [groupedByPerson, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(3)].map((_, idx) => (
          <Card key={idx} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center space-y-4">
          <p className="text-red-400 font-sans">Error loading people: {error}</p>
          <Button
            onClick={refetch}
            variant="outline"
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 font-sans"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (groupedByPerson.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6 text-center space-y-2">
          <Users className="w-10 h-10 text-gray-400 mx-auto" />
          <p className="text-white font-semibold font-sans">No people yet</p>
          <p className="text-gray-400 text-sm font-sans">
            Upload a screenshot in Huddle to start building conversations by person.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 relative">
      {showInfo && (
        <div className="fixed top-20 right-4 z-30 w-72 max-w-[90vw] bg-gray-900/90 border border-gray-700 shadow-xl rounded-lg p-3 text-xs text-gray-200 font-sans">
          <div className="flex items-start justify-between gap-2">
            <p>Names come from the screenshot text; grouping happens only when the extracted name matches exactly.</p>
            <button
              aria-label="Close info"
              className="text-gray-400 hover:text-white"
              onClick={dismissInfo}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-300 font-sans">
          Search or browse people grouped by extracted names.
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or handle"
            className="pl-9 pr-9 bg-white text-slate-900 border border-gray-200 placeholder:text-gray-500 dark:bg-gray-900/80 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {visibleGroups.length === 0 && (
        <Card className="bg-gray-800/70 border border-gray-700/70 rounded-xl">
          <CardContent className="p-5 text-center text-sm text-gray-300 font-sans">
            No matches found for “{searchQuery.trim()}”.
          </CardContent>
        </Card>
      )}

      {visibleGroups.map((group) => (
        <Card
          key={group.name}
          className="bg-gray-800/70 border border-gray-700/70 rounded-xl overflow-hidden"
        >
          <CardContent className="p-4 space-y-3">
            <button
              className="flex justify-between items-start gap-3 w-full text-left"
              onClick={() => {
                setExpandedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.name)) {
                    next.delete(group.name);
                  } else {
                    next.add(group.name);
                  }
                  return next;
                });
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-white font-semibold text-lg font-sans">{group.name}</p>
                  <p className="text-gray-400 text-xs font-sans">
                    {group.huddles.length} {group.huddles.length === 1 ? 'conversation' : 'conversations'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(group.rawNames)
                      .filter((raw) => raw !== group.name)
                      .map((raw) => (
                        <Badge key={raw} variant="outline" className="text-xxs lowercase font-sans">
                          {raw}
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 font-sans">
                <Calendar className="w-4 h-4" />
                <span>
                  Last chatted {formatDistanceToNow(group.lastInteraction, { addSuffix: true })}
                </span>
              </div>
            </button>

            {expandedGroups.has(group.name) && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <input
                      value={renameDrafts[group.name] ?? ''}
                      onChange={(e) =>
                        setRenameDrafts((prev) => ({ ...prev, [group.name]: e.target.value }))
                      }
                      placeholder="Rename or merge (enter correct name/handle)"
                      className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-md px-3 py-2 font-sans"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-purple-600 hover:bg-purple-700 text-white font-sans"
                      onClick={() => saveRename(group, renameDrafts[group.name] ?? '')}
                    >
                      Save
                    </Button>
                    {renameDrafts[group.name] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-300 font-sans"
                        onClick={() =>
                          setRenameDrafts((prev) => {
                            const next = { ...prev };
                            delete next[group.name];
                            return next;
                          })
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {group.huddles
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    )
                    .map((huddle) => (
                      <div
                        key={huddle.id}
                        className="bg-gray-900/70 border border-gray-700 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex justify-between items-start text-xs text-gray-400 font-sans">
                          <span>{formatDistanceToNow(new Date(huddle.created_at), { addSuffix: true })}</span>
                          {huddle.selected_tone && huddle.selected_tone !== 'none' && (
                            <Badge variant="secondary" className="font-sans capitalize">
                              {huddle.selected_tone}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-200 font-sans line-clamp-2">
                          {huddle.user_draft}
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-400 font-sans">
                          <MessageCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <p className="line-clamp-3">{huddle.screenshot_text}</p>
                        </div>
                        <div className="bg-gray-800/60 border border-gray-700/60 rounded-md p-2 text-xs text-white font-sans">
                          {huddle.final_reply || huddle.generated_reply}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
