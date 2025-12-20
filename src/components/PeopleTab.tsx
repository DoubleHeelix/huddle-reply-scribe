import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCcw, Users, MessageCircle, Calendar, Search } from 'lucide-react';
import { useHuddlePlays } from '@/hooks/useHuddlePlays';
import { formatDistanceToNow } from 'date-fns';
import { extractPersonName } from '@/utils/extractPersonName';
import {
  clearHuddlePersonOverride,
  getPeopleOverrides,
  getHuddlePersonOverrides,
  savePeopleOverrides,
  saveHuddlePersonOverride,
  type HuddlePlay,
} from '@/utils/huddlePlayService';

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

interface PersonGroup {
  name: string;
  huddles: HuddlePlay[];
  lastInteraction: number;
  rawNames: Set<string>;
}

export const PeopleTab = () => {
  const { huddlePlays, isLoading, error, refetch } = useHuddlePlays();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [messageOverrides, setMessageOverrides] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [messageRenameDrafts, setMessageRenameDrafts] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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

  // Load per-message overrides from localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('huddle_person_overrides');
    if (stored) {
      try {
        setMessageOverrides(JSON.parse(stored));
      } catch {
        setMessageOverrides({});
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRemoteOverrides = async () => {
      try {
        const remote = await getPeopleOverrides();
        if (!cancelled && remote) {
          setOverrides((prev) => ({ ...remote, ...prev }));
        }
      } catch (err) {
        console.error('Error loading people overrides', err);
      }
    };
    loadRemoteOverrides();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRemoteMessageOverrides = async () => {
      try {
        const remote = await getHuddlePersonOverrides();
        if (!cancelled && remote) {
          setMessageOverrides((prev) => ({ ...remote, ...prev }));
        }
      } catch (err) {
        console.error('Error loading huddle person overrides', err);
      }
    };
    loadRemoteMessageOverrides();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('people_overrides', JSON.stringify(overrides));
  }, [overrides]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('huddle_person_overrides', JSON.stringify(messageOverrides));
  }, [messageOverrides]);

  const applyOverride = useCallback(
    (rawName: string, huddleId?: string) => {
      if (huddleId && messageOverrides[huddleId]) {
        return messageOverrides[huddleId];
      }
      return overrides[rawName] || rawName;
    },
    [messageOverrides, overrides]
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
    const rawNames = Array.from(group.rawNames);
    savePeopleOverrides(rawNames.map((raw) => ({ raw_name: raw, override: newName }))).catch(
      (err) => console.error('Error saving people overrides', err)
    );
  };

  const saveMessageRename = (huddle: HuddlePlay, newNameRaw: string) => {
    const newName = newNameRaw.trim();
    if (!newName) return;
    const rawName = extractPersonName(huddle.screenshot_text);
    setMessageOverrides((prev) => ({ ...prev, [huddle.id]: newName }));
    setMessageRenameDrafts((prev) => {
      const next = { ...prev };
      delete next[huddle.id];
      return next;
    });
    saveHuddlePersonOverride(huddle.id, newName, rawName).catch((err) =>
      console.error('Error saving huddle person override', err)
    );
  };

  const resetMessageRename = (huddleId: string) => {
    setMessageOverrides((prev) => {
      const next = { ...prev };
      delete next[huddleId];
      return next;
    });
    setMessageRenameDrafts((prev) => {
      const next = { ...prev };
      delete next[huddleId];
      return next;
    });
    clearHuddlePersonOverride(huddleId).catch((err) =>
      console.error('Error clearing huddle person override', err)
    );
  };

  const filteredPlays = useMemo(
    () => huddlePlays.filter((h) => !isWhatsAppText(h.screenshot_text)),
    [huddlePlays]
  );

  const groupedByPerson = useMemo<PersonGroup[]>(() => {
    const groups = new Map<string, PersonGroup>();

    filteredPlays.forEach((huddle) => {
      const rawName = extractPersonName(huddle.screenshot_text);
      const name = applyOverride(rawName, huddle.id);
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
                    .map((huddle) => {
                      const detectedName = extractPersonName(huddle.screenshot_text);
                      const appliedName = applyOverride(detectedName, huddle.id);
                      const messageDraft =
                        messageRenameDrafts[huddle.id] ??
                        messageOverrides[huddle.id] ??
                        appliedName;
                      const hasMessageOverride = Boolean(messageOverrides[huddle.id]);

                      return (
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

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-800/60 border border-gray-700/60 rounded-md p-2">
                            <div className="text-xs text-gray-300 font-sans">
                              Linked to <span className="text-white font-semibold">{appliedName}</span>
                              <span className="text-gray-500 ml-2">(detected: {detectedName})</span>
                              {hasMessageOverride && (
                                <span className="ml-2 text-purple-300">custom</span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Input
                                value={messageDraft}
                                onChange={(e) =>
                                  setMessageRenameDrafts((prev) => ({
                                    ...prev,
                                    [huddle.id]: e.target.value,
                                  }))
                                }
                                placeholder="Link this message to a person"
                                className="bg-gray-900 border-gray-700 text-white text-xs"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-sans"
                                  onClick={() => saveMessageRename(huddle, messageDraft)}
                                >
                                  Save
                                </Button>
                                {hasMessageOverride && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-gray-300 font-sans"
                                    onClick={() => resetMessageRename(huddle.id)}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-800/60 border border-gray-700/60 rounded-md p-2 text-xs text-white font-sans">
                            {huddle.final_reply || huddle.generated_reply}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
