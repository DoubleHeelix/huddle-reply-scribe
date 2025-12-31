import { useCallback, useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { Input as ShadInput } from "@/components/ui/input";
import { useHuddlePlays } from "@/hooks/useHuddlePlays";
import { extractPersonName } from "@/utils/extractPersonName";
import {
  getPeopleOverrides,
  savePeopleOverrides,
  getHuddlePersonOverrides,
  saveHuddlePersonOverride,
  clearHuddlePersonOverride,
  deletePersonAssociations,
  getTrelloBoardPositions,
  upsertTrelloBoardPositions,
  deleteTrelloBoardPositions,
  type HuddlePlay,
} from "@/utils/huddlePlayService";
import { formatDistanceToNow } from "date-fns";

type ColumnId = string;
type Mode = "convo" | "process";

const STORAGE_KEY = "trello_board_state";
const TOUCH_KEY = "trello_last_touched";
const HIDDEN_KEY = "trello_hidden_names";
const TIMESTAMP_KEY = "trello_last_timestamp";

type ColumnConfig = { id: ColumnId; label: string; description: string; badgeClass: string };

const columnSets: Record<Mode, ColumnConfig[]> = {
  convo: [
    { id: "Unassigned", label: "Unassigned", description: "Auto-filled from your saved conversations", badgeClass: "bg-slate-700/40 text-slate-100" },
    { id: "OLB", label: "OLB", description: "One-Line-Bridge", badgeClass: "bg-amber-500/20 text-amber-200" },
    { id: "MPA", label: "MPA", description: "Made Aware", badgeClass: "bg-indigo-500/20 text-indigo-200" },
    { id: "DTM", label: "DTM", description: "Door Opened", badgeClass: "bg-emerald-500/20 text-emerald-200" },
    { id: "STP", label: "STP", description: "Process Started", badgeClass: "bg-cyan-500/20 text-cyan-200" },
    { id: "Removed", label: "Removed", description: "Removed", badgeClass: "bg-rose-500/20 text-rose-200" },
  ],
  process: [
    { id: "MeetGreet1", label: "Meet and Greet 1", description: "First meeting touchpoint", badgeClass: "bg-indigo-500/20 text-indigo-200" },
    { id: "MeetGreet2", label: "Meet and Greet 2", description: "Second meeting touchpoint", badgeClass: "bg-indigo-400/25 text-indigo-100" },
    { id: "FU1", label: "FU1", description: "Follow-up 1", badgeClass: "bg-amber-500/20 text-amber-200" },
    { id: "FU2", label: "FU2", description: "Follow-up 2", badgeClass: "bg-amber-400/25 text-amber-100" },
    { id: "FU3", label: "FU3", description: "Follow-up 3", badgeClass: "bg-amber-300/25 text-amber-50" },
    { id: "PRC", label: "PRC", description: "Process control", badgeClass: "bg-emerald-500/20 text-emerald-200" },
  ],
};

type BoardState = Record<ColumnId, string[]>;
type BoardByMode = Record<Mode, BoardState>;

const createEmptyBoard = (cols: { id: ColumnId }[]): BoardState => {
  const empty: BoardState = {};
  cols.forEach((c) => {
    empty[c.id] = [];
  });
  return empty;
};

export const TrelloTab = () => {
  // Auto-fetch conversations so names and timestamps are immediately available.
  const { huddlePlays } = useHuddlePlays({ light: true, maxRows: 250 });
  const [mode, setMode] = useState<Mode>("convo");
  const [modeTransition, setModeTransition] = useState<"idle" | "to-process" | "to-convo">("idle");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [messageOverrides, setMessageOverrides] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [messageRenameDrafts, setMessageRenameDrafts] = useState<Record<string, string>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<ColumnId, boolean>>({});
  const [collapsing, setCollapsing] = useState<Record<ColumnId, boolean>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ column: ColumnId; name: string } | null>(null);
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(HIDDEN_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch (err) {
      console.warn("Unable to read hidden names from storage", err);
    }
    return new Set();
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [dragging, setDragging] = useState<{ name: string; from: ColumnId } | null>(null);
  const [activeDrop, setActiveDrop] = useState<ColumnId | null>(null);
  const [lastTouched, setLastTouched] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(TOUCH_KEY);
      if (stored) return JSON.parse(stored) as Record<string, number>;
    } catch (err) {
      console.warn("Unable to read touch timestamps from storage", err);
    }
    return {};
  });
  const [cachedTimestamps, setCachedTimestamps] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(TIMESTAMP_KEY);
      if (stored) return JSON.parse(stored) as Record<string, number>;
    } catch (err) {
      console.warn("Unable to read last timestamps from storage", err);
    }
    return {};
  });

  const loadBoardForMode = (nextMode: Mode): BoardState => {
    const cols = columnSets[nextMode];
    if (typeof window === "undefined") return createEmptyBoard(cols);
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${nextMode}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BoardState>;
        return { ...createEmptyBoard(cols), ...parsed };
      }
    } catch (err) {
      console.warn("Unable to read Trello board from storage", err);
    }
    return createEmptyBoard(cols);
  };

  const [boards, setBoards] = useState<BoardByMode>(() => ({
    convo: loadBoardForMode("convo"),
    process: loadBoardForMode("process"),
  }));

  // Hydrate from Supabase so column placements persist across devices.
  useEffect(() => {
    let cancelled = false;
    const loadRemoteBoard = async () => {
      try {
        const positions = await getTrelloBoardPositions();
        if (cancelled || !positions.length) return;
        setBoards((prev) => {
          const next: BoardByMode = {
            convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
            process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
          };

          (["convo", "process"] as Mode[]).forEach((m) => {
            const cols = columnSets[m];
            if (!next[m]) next[m] = createEmptyBoard(cols);
            const modePositions = positions.filter((p) => p.mode === m);
            if (!modePositions.length) return;

            // Remove any existing placements for the names, then add the persisted target.
            modePositions.forEach((pos) => {
              Object.keys(next[m]).forEach((colId) => {
                next[m][colId] = (next[m][colId] || []).filter((n) => n !== pos.name);
              });
              if (!next[m][pos.column_id]) next[m][pos.column_id] = [];
              next[m][pos.column_id] = [pos.name, ...(next[m][pos.column_id] || [])];
            });
          });

          persistBoards(next);
          return next;
        });
      } catch (err) {
        console.error("Error loading trello board positions", err);
      }
    };

    loadRemoteBoard();
    return () => {
      cancelled = true;
    };
  }, [persistBoards]);

  const handleModeChange = useCallback(
    (nextMode: Mode) => {
      if (nextMode === mode) return;
      setModeTransition(nextMode === "process" ? "to-process" : "to-convo");
      setMode(nextMode);
    },
    [mode]
  );

  useEffect(() => {
    if (modeTransition === "idle") return;
    const timer = setTimeout(() => setModeTransition("idle"), 700);
    return () => clearTimeout(timer);
  }, [modeTransition]);

  const board = useMemo(() => {
    const base = boards[mode] ?? createEmptyBoard(columnSets[mode]);
    const filled: BoardState = { ...base };
    columnSets[mode].forEach((col) => {
      if (!filled[col.id]) filled[col.id] = [];
    });
    return filled;
  }, [boards, mode]);

  const [drafts, setDrafts] = useState<Record<ColumnId, string>>(() =>
    columnSets["convo"].reduce(
      (acc, col) => ({ ...acc, [col.id]: "" }),
      {} as Record<ColumnId, string>
    )
  );

  const columns = columnSets[mode];
  const modeAnimationClass =
    modeTransition === "to-process"
      ? "trello-mode-to-process"
      : modeTransition === "to-convo"
      ? "trello-mode-to-convo"
      : "";
  const allColumns = useMemo(() => {
    const map = new Map<ColumnId, ColumnConfig & { mode: Mode }>();
    columnSets.convo.forEach((c) => map.set(c.id, { ...c, mode: "convo" }));
    columnSets.process.forEach((c) => map.set(c.id, { ...c, mode: "process" }));
    return Array.from(map.values());
  }, []);

  const columnLookup = useMemo(() => {
    const lookup: Record<ColumnId, ColumnConfig & { mode: Mode }> = {};
    allColumns.forEach((c) => {
      lookup[c.id] = c;
    });
    return lookup;
  }, [allColumns]);

  const columnOrder = useMemo(() => columns.map((c) => c.id), [columns]);

  const columnTargets = useMemo(() => {
    const allIds = allColumns.map((c) => c.id);
    const targets: Record<ColumnId, ColumnId[]> = {};
    allIds.forEach((col) => {
      targets[col] = allIds.filter((c) => c !== col);
    });
    return targets;
  }, [allColumns]);

  // Keep overrides in sync with People tab behavior.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("people_overrides");
    if (stored) {
      try {
        setOverrides(JSON.parse(stored));
      } catch {
        setOverrides({});
      }
    }
    const storedMessage = localStorage.getItem("huddle_person_overrides");
    if (storedMessage) {
      try {
        setMessageOverrides(JSON.parse(storedMessage));
      } catch {
        setMessageOverrides({});
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRemote = async () => {
      try {
        const remote = await getPeopleOverrides();
        if (!cancelled && remote) {
          setOverrides((prev) => ({ ...remote, ...prev }));
        }
      } catch (err) {
        console.error("Error loading people overrides", err);
      }
    };
    loadRemote();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRemoteMessage = async () => {
      try {
        const remote = await getHuddlePersonOverrides();
        if (!cancelled && remote) {
          setMessageOverrides((prev) => ({ ...remote, ...prev }));
        }
      } catch (err) {
        console.error("Error loading huddle person overrides", err);
      }
    };
    loadRemoteMessage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("people_overrides", JSON.stringify(overrides));
  }, [overrides]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("huddle_person_overrides", JSON.stringify(messageOverrides));
  }, [messageOverrides]);

  const applyOverride = useCallback(
    (rawName: string, huddleId?: string) => {
      if (huddleId && messageOverrides[huddleId]) {
        return messageOverrides[huddleId];
      }
      return overrides[rawName] || rawName || "Unknown";
    },
    [messageOverrides, overrides]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    (["convo", "process"] as Mode[]).forEach((m) => {
      localStorage.setItem(`${STORAGE_KEY}_${m}`, JSON.stringify(boards[m]));
    });
  }, [boards]);

  const isWhatsAppText = (text: string | null | undefined): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes("whatsapp") ||
      lower.includes("end-to-end encrypted") ||
      lower.includes("type a message") ||
      lower.includes("typing…") ||
      lower.includes("online") ||
      lower.includes("status") ||
      lower.includes("calls") ||
      lower.includes("chats")
    );
  };

  const filteredPlays = useMemo(
    () => huddlePlays.filter((h) => !isWhatsAppText(h.screenshot_text)),
    [huddlePlays]
  );

  const groupedByName = useMemo(() => {
    const groups = new Map<
      string,
      { appliedName: string; rawNames: Set<string>; huddles: HuddlePlay[] }
    >();

    filteredPlays.forEach((huddle) => {
      const rawName = extractPersonName(huddle.screenshot_text);
      const appliedName = applyOverride(rawName, huddle.id);
      const existing = groups.get(appliedName);
      if (existing) {
        existing.huddles.push(huddle);
        existing.rawNames.add(rawName);
      } else {
        groups.set(appliedName, {
          appliedName,
          rawNames: new Set([rawName]),
          huddles: [huddle],
        });
      }
    });

    return groups;
  }, [applyOverride, filteredPlays]);

  const autoNameEntries = useMemo(() => {
    const entries: { name: string; last: number }[] = [];
    groupedByName.forEach((value, key) => {
      if (hiddenNames.has(key)) return;
      const last = Math.max(...value.huddles.map((h) => new Date(h.created_at).getTime()));
      entries.push({ name: key, last });
    });
    entries.sort((a, b) => b.last - a.last);
    return entries;
  }, [groupedByName, hiddenNames]);

  const lastTimestampByName = useMemo(() => {
    // Start with cached timestamps to preserve recency ordering even before data is loaded.
    const map = new Map<string, number>(Object.entries(cachedTimestamps));
    groupedByName.forEach((value, key) => {
      const last = Math.max(...value.huddles.map((h) => new Date(h.created_at).getTime()));
      if (isFinite(last)) map.set(key, last);
    });
    return map;
  }, [cachedTimestamps, groupedByName]);

  const lastTimestampLabelByName = useMemo(() => {
    const map = new Map<string, string>();
    lastTimestampByName.forEach((ts, name) => {
      if (isFinite(ts)) {
        map.set(name, formatDistanceToNow(new Date(ts), { addSuffix: true }));
      }
    });
    return map;
  }, [lastTimestampByName]);

  // Persist latest timestamps whenever fresh data is available.
  useEffect(() => {
    if (!huddlePlays.length || groupedByName.size === 0) return; // avoid wiping cached order when not loaded
    const next: Record<string, number> = {};
    groupedByName.forEach((value, key) => {
      const last = Math.max(...value.huddles.map((h) => new Date(h.created_at).getTime()));
      if (isFinite(last)) next[key] = last;
    });
    setCachedTimestamps(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TIMESTAMP_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn("Unable to persist last timestamps", err);
      }
    }
  }, [groupedByName, huddlePlays.length]);

  const autoSigRef = useRef<string>("");

  const persistBoards = useCallback((next: BoardByMode) => {
    if (typeof window === "undefined") return;
    (["convo", "process"] as Mode[]).forEach((m) => {
      localStorage.setItem(`${STORAGE_KEY}_${m}`, JSON.stringify(next[m]));
    });
  }, []);

  useEffect(() => {
    if (mode !== "convo" || !autoNameEntries.length) return;
    const signature = JSON.stringify(autoNameEntries.map((e) => e.name));
    if (autoSigRef.current === signature) return;
    autoSigRef.current = signature;
    setBoards((prev) => {
      const current = prev[mode] ?? createEmptyBoard(columnSets[mode]);
      const autoNameSet = new Set(autoNameEntries.map((e) => e.name));

      // Keep manual names that are not part of auto-detected list.
      const manual = (current.Unassigned || []).filter((name) => !autoNameSet.has(name));

      const presentElsewhere = new Set<string>();
      Object.values(prev).forEach((boardByMode) => {
        if (!boardByMode) return;
        Object.entries(boardByMode).forEach(([colId, list]) => {
          if (colId === "Unassigned") return;
          (list || []).forEach((name) => presentElsewhere.add(name));
        });
      });

      const autoOrdered = autoNameEntries
        .map((entry) => entry.name)
        .filter((name) => !presentElsewhere.has(name));

      const desiredOrder = Array.from(new Set([...manual, ...autoOrdered]));

      const currentUnassigned = current.Unassigned || [];
      const isSameLength = currentUnassigned.length === desiredOrder.length;
      const isSame =
        isSameLength &&
        currentUnassigned.every((name, idx) => name === desiredOrder[idx]);
      if (isSame) return prev;

      const next = {
        ...prev,
        [mode]: { ...current, Unassigned: desiredOrder },
      };
      persistBoards(next);
      return next;
    });
  }, [autoNameEntries, mode, persistBoards]);

  const filteredBoard = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const next: BoardState = {};
    const include = (name: string) =>
      !hiddenNames.has(name) && (!q || name.toLowerCase().includes(q));
    Object.keys(board).forEach((col) => {
      next[col] = (board[col] || []).filter((name) => include(name));
    });
    return next;
  }, [board, hiddenNames, searchQuery]);
  const orderNames = useCallback(
    (names: string[]) =>
      names
        .slice()
        .sort((a, b) => {
          const lastA = lastTimestampByName.get(a) ?? 0;
          const lastB = lastTimestampByName.get(b) ?? 0;
          if (lastA !== lastB) return lastB - lastA;
          const touchA = lastTouched[a] ?? 0;
          const touchB = lastTouched[b] ?? 0;
          if (touchA !== touchB) return touchB - touchA;
          return a.localeCompare(b);
        }),
    [lastTimestampByName, lastTouched]
  );

  // Keep stored board ordering in sync with recency so rendered lists and persisted state match.
  useEffect(() => {
    setBoards((prev) => {
      const next: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };
      (["convo", "process"] as Mode[]).forEach((m) => {
        Object.keys(next[m]).forEach((colId) => {
          next[m][colId] = orderNames(next[m][colId] || []);
        });
      });
      persistBoards(next);
      return next;
    });
  }, [orderNames, persistBoards]);

  const selectedGroup = useMemo(() => {
    if (!selectedName) return null;
    return groupedByName.get(selectedName) || null;
  }, [groupedByName, selectedName]);

  useEffect(() => {
    const cols = columnSets[mode];
    setCollapsed((prev) => {
      const next: Record<ColumnId, boolean> = {};
      cols.forEach((col) => {
        next[col.id] = prev[col.id] ?? false;
      });
      return next;
    });
    setCollapsing({});
    setDrafts((prev) => {
      const next: Record<ColumnId, string> = {};
      cols.forEach((col) => {
        next[col.id] = prev[col.id] ?? "";
      });
      return next;
    });
    setBoards((prev) => {
      if (prev[mode]) return prev;
      const next = { ...prev, [mode]: loadBoardForMode(mode) };
      persistBoards(next);
      return next;
    });
  }, [mode, persistBoards]);

  // Strip hidden names from existing board state whenever the hidden list changes.
  useEffect(() => {
    setBoards((prev) => {
      const next: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };
      (["convo", "process"] as Mode[]).forEach((m) => {
        Object.keys(next[m]).forEach((colId) => {
          next[m][colId] = (next[m][colId] || []).filter((name) => !hiddenNames.has(name));
        });
      });
      persistBoards(next);
      return next;
    });
  }, [hiddenNames, persistBoards]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOUCH_KEY, JSON.stringify(lastTouched));
  }, [lastTouched]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hiddenNames)));
  }, [hiddenNames]);

  const setColumnCollapsed = useCallback(
    (columnId: ColumnId, shouldCollapse: boolean) => {
      if (shouldCollapse) {
        setCollapsed((prev) => ({ ...prev, [columnId]: true }));
        setCollapsing((prev) => ({ ...prev, [columnId]: true }));
        setTimeout(() => {
          setCollapsing((prev) => {
            if (!prev[columnId]) return prev;
            const next = { ...prev };
            delete next[columnId];
            setCollapsed((prevCollapsed) => ({ ...prevCollapsed, [columnId]: true }));
            return next;
          });
        }, 380);
      } else {
        setCollapsed((prev) => ({ ...prev, [columnId]: false }));
        setCollapsing((prev) => {
          const next = { ...prev };
          delete next[columnId];
          return next;
        });
      }
    },
    []
  );

  const addName = (column: ColumnId) => {
    const value = (drafts[column] || "").trim();
    if (!value) return;
    setBoards((prev) => {
      const next: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };

      const boardRef = next[mode];
      columnSets[mode].forEach((col) => {
        if (!boardRef[col.id]) boardRef[col.id] = [];
      });

      // Newest names appear at the top of the list.
      boardRef[column] = [value, ...(boardRef[column] || [])];
      persistBoards(next);
      return next;
    });
    setDrafts((prev) => ({ ...prev, [column]: "" }));
    setLastTouched((prev) => ({ ...prev, [value]: Date.now() }));
    setHiddenNames((prev) => {
      if (!prev.has(value)) return prev;
      const next = new Set(prev);
      next.delete(value);
      return next;
    });
    upsertTrelloBoardPositions([{ name: value, column_id: column, mode }]).catch((err) => {
      console.error("Error saving trello position", err);
    });
  };

  const saveRename = async (groupName: string, rawNames: Set<string>, newNameRaw: string) => {
    const newName = newNameRaw.trim();
    if (!newName) return;
    setOverrides((prev) => {
      const next = { ...prev };
      rawNames.forEach((raw) => {
        next[raw] = newName;
      });
      return next;
    });
    setRenameDrafts((prev) => {
      const next = { ...prev };
      delete next[groupName];
      return next;
    });
    const rawArray = Array.from(rawNames);
    savePeopleOverrides(rawArray.map((raw) => ({ raw_name: raw, override: newName }))).catch(
      (err) => console.error("Error saving people overrides", err)
    );

    // Keep board labels in sync with the new name.
    setBoards((prev) => {
      const next: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };
      const current = next[mode];
      columnSets[mode].forEach((col) => {
        if (!current[col.id]) current[col.id] = [];
      });
      columnOrder.forEach((col) => {
        current[col] = (current[col] || []).map((name) => (name === groupName ? newName : name));
      });
      persistBoards(next);
      return next;
    });
    setSelectedName(newName);
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
      console.error("Error saving huddle person override", err)
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
      console.error("Error clearing huddle person override", err)
    );
  };

  const removeName = (column: ColumnId, targetName: string) => {
    let removedName: string | null = null;
    setBoards((prev) => {
      const next: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };
      const current = next[mode];
      columnSets[mode].forEach((col) => {
        if (!current[col.id]) current[col.id] = [];
      });
      removedName = targetName;

      // Remove from every column in every mode to avoid ghost reappearances.
      (["convo", "process"] as Mode[]).forEach((m) => {
        const boardRef = next[m];
        Object.keys(boardRef).forEach((colId) => {
          boardRef[colId] = (boardRef[colId] || []).filter((n) => n !== removedName);
        });
      });

      persistBoards(next);
      return next;
    });

    if (removedName) {
      setHiddenNames((prev) => new Set(prev).add(removedName));
      setLastTouched((prev) => {
        const next = { ...prev };
        delete next[removedName];
        return next;
      });
      deleteTrelloBoardPositions([removedName]).catch((err) =>
        console.error("Error deleting trello position", err)
      );
    }
    return removedName;
  };

  const confirmAndRemoveName = (column: ColumnId, name: string) => {
    setPendingDelete({ column, name });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const removed = removeName(pendingDelete.column, pendingDelete.name);
    setPendingDelete(null);
    if (removed) {
      try {
        await deletePersonAssociations(removed);
      } catch (err) {
        console.error("Error deleting person associations from Supabase", err);
      }
    }
  };

  const moveName = (from: ColumnId, name: string, to: ColumnId) => {
    const targetMeta = columnLookup[to];
    const targetMode = targetMeta?.mode ?? (columnSets.convo.some((c) => c.id === to) ? "convo" : "process");

    setBoards((prev) => {
      const nextBoards: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };

      // Ensure all columns exist
      Object.entries(columnSets).forEach(([m, cols]) => {
        cols.forEach((col) => {
          if (!nextBoards[m as Mode][col.id]) {
            nextBoards[m as Mode][col.id] = [];
          }
        });
      });

      const sourceBoard = nextBoards[mode];
      const sourceList = sourceBoard[from] || [];
      const entryIndex = sourceList.findIndex((n) => n === name);
      if (entryIndex === -1) return prev;
      const entry = sourceList[entryIndex];

      // Remove the entry from every column in every board to avoid duplicates.
      (["convo", "process"] as Mode[]).forEach((m) => {
        const boardRef = nextBoards[m];
        Object.keys(boardRef).forEach((colId) => {
          boardRef[colId] = (boardRef[colId] || []).filter((n) => n !== entry);
        });
      });

      // Add to target (ordering handled by renderer)
      nextBoards[targetMode][to] = [entry, ...(nextBoards[targetMode][to] || [])];

      persistBoards(nextBoards);
      return nextBoards;
    });
    setLastTouched((prev) => ({ ...prev, [name]: Date.now() }));
    setHiddenNames((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    upsertTrelloBoardPositions([{ name, column_id: to, mode: targetMode }]).catch((err) => {
      console.error("Error saving trello position", err);
    });
  };

  const clearBoard = () => {
    const cols = columnSets[mode];
    const namesToClear = Object.values(board || {}).flat();
    setBoards((prev) => ({ ...prev, [mode]: createEmptyBoard(cols) }));
    setDrafts(
      cols.reduce((acc, col) => ({ ...acc, [col.id]: "" }), {} as Record<ColumnId, string>)
    );
    if (namesToClear.length) {
      deleteTrelloBoardPositions(namesToClear, mode).catch((err) =>
        console.error("Error clearing trello positions", err)
      );
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent className="bg-slate-950 border border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Reset board?</AlertDialogTitle>
            <p className="text-sm text-slate-400">
              This clears all names from every column. You can’t undo this action.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                clearBoard();
                setShowResetConfirm(false);
              }}
            >
              Reset board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="bg-slate-950 border border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Remove this name?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-400">
              {pendingDelete?.name
                ? `Remove "${pendingDelete.name}" from the board.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleConfirmDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-center gap-3 pt-2">
        <Button
                  variant={mode === "convo" ? "default" : "outline"}
                  onClick={() => handleModeChange("convo")}
                  className={mode === "convo" ? "bg-cyan-600 text-white" : "border-slate-700 bg-slate-900 text-slate-200"}
                >
                  Convo
        </Button>
        <Button
          variant={mode === "process" ? "default" : "outline"}
          onClick={() => handleModeChange("process")}
                  className={mode === "process" ? "bg-cyan-600 text-white" : "border-slate-700 bg-slate-900 text-slate-200"}
                >
                  Process
                </Button>
              </div>

      <div className="w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-2 lg:px-4">
        <ShadInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search names across columns"
          className="bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 h-11 lg:h-12 lg:text-base"
        />
      </div>


      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 ${modeAnimationClass}`}
      >
        {columns.map((column) => {
          const isCollapsed = collapsed[column.id] ?? false;
          const isCollapsing = Boolean(collapsing[column.id]);
          const shouldShowContent = !isCollapsed || isCollapsing;
          return (
            <Card
              key={column.id}
              className={`border-slate-800/70 bg-slate-900/70 backdrop-blur lg:min-h-[380px] lg:rounded-2xl lg:border-slate-800 lg:hover:border-slate-700 transition-colors ${
                activeDrop === column.id ? "border-cyan-500/60 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]" : ""
              }`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setActiveDrop(column.id);
              }}
              onDragEnter={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setActiveDrop(column.id);
              }}
              onDragLeave={() => {
                if (activeDrop === column.id) {
                  setActiveDrop(null);
                }
              }}
              onDrop={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setActiveDrop(null);
                if (dragging.from !== column.id) {
                  moveName(dragging.from, dragging.name, column.id);
                }
                setDragging(null);
              }}
            >
            <CardHeader className="space-y-2 pb-3 lg:pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  {column.label}
                  <button
                    onClick={() => setColumnCollapsed(column.id, !isCollapsed)}
                    className="text-slate-300 hover:text-white transition-colors"
                    aria-label={isCollapsed ? "Expand column" : "Collapse column"}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </button>
                </CardTitle>
                <Badge className={`text-xs ${column.badgeClass}`}>
                  {(filteredBoard[column.id] || []).length} item{(filteredBoard[column.id] || []).length === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="text-sm text-slate-400 lg:text-[15px] lg:text-slate-300">{column.description}</p>
            </CardHeader>

            <CardContent className="space-y-3">
              {shouldShowContent && (
                <div
                  className={`space-y-3 ${
                    isCollapsing ? "trello-column-collapse" : "trello-column-uncollapse"
                  }`}
                >
                  <div className="flex gap-2 lg:gap-3">
                    <Input
                      value={drafts[column.id] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [column.id]: e.target.value }))}
                      placeholder="Add a name"
                      className="bg-slate-950/80 text-white placeholder:text-slate-500 lg:h-11 lg:text-base"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addName(column.id);
                        }
                      }}
                    />
                    <Button type="button" onClick={() => addName(column.id)} className="shrink-0 lg:h-11 lg:px-4">
                      <Plus className="h-4 w-4 mr-1.5 lg:h-5 lg:w-5" />
                      Add
                    </Button>
                  </div>

                    <div className="space-y-2">
                      {(filteredBoard[column.id] || []).length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/70 px-3 py-4 text-center text-sm text-slate-500">
                          Nothing here yet. Add the first name.
                        </div>
                      )}

                      {orderNames(filteredBoard[column.id] || []).map((name, idx) => (
                        <div
                          key={`${column.id}-${idx}-${name}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-white shadow-sm"
                          draggable
                          onDragStart={() => {
                            setDragging({ name, from: column.id });
                            setActiveDrop(column.id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setActiveDrop(null);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <button
                              className="truncate text-left hover:text-cyan-200 w-full"
                              onClick={() => setSelectedName(name)}
                          >
                            {name}
                          </button>
                          {lastTimestampLabelByName.get(name) && (
                            <div className="text-[11px] text-slate-400 truncate">
                              Last chatted {lastTimestampLabelByName.get(name)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-200 hover:bg-slate-800">
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-slate-950 text-slate-100 border border-slate-800 shadow-lg shadow-black/40 min-w-[260px] max-h-[320px] overflow-y-auto"
                            >
                              <div className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-slate-500">
                                Convo columns
                              </div>
                              {allColumns
                                .filter((t) => t.mode === "convo" && t.id !== column.id)
                                .map((target) => (
                                  <DropdownMenuItem
                                    key={target.id}
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      moveName(column.id, name, target.id);
                                    }}
                                    className="cursor-pointer focus:bg-slate-800/80 text-sm flex items-center justify-between"
                                  >
                                    <span>{target.label}</span>
                                    <span className="text-[11px] text-slate-500">Convo</span>
                                  </DropdownMenuItem>
                                ))}

                              <div className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-slate-500 border-t border-slate-800">
                                Process columns
                              </div>
                              {allColumns
                                .filter((t) => t.mode === "process" && t.id !== column.id)
                                .map((target) => (
                                  <DropdownMenuItem
                                    key={target.id}
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      moveName(column.id, name, target.id);
                                    }}
                                    className="cursor-pointer focus:bg-slate-800/80 text-sm flex items-center justify-between"
                                  >
                                    <span>{target.label}</span>
                                    <span className="text-[11px] text-amber-400">Process</span>
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmAndRemoveName(column.id, name)}
                            className="h-8 w-8 text-rose-200 hover:bg-rose-900/40 hover:text-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
        >
          Reset board
        </Button>
      </div>

      <Dialog open={Boolean(selectedName)} onOpenChange={(open) => !open && setSelectedName(null)}>
        <DialogContent className="max-w-3xl bg-slate-950 text-white border border-slate-800 max-h-[90vh] overflow-y-auto">
          {selectedGroup ? (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold text-white">{selectedGroup.appliedName}</h2>
              <p className="text-sm text-slate-400">
                Showing most recent conversation{selectedGroup.huddles.length > 1 ? ` of ${selectedGroup.huddles.length}` : ""}
              </p>

              {selectedGroup.huddles.length === 0 ? (
                <div className="text-sm text-slate-300 text-center py-4">
                  No conversations found for this person yet.
                </div>
              ) : (
                (() => {
                  const [latest] = selectedGroup.huddles
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                    );
                  const detectedName = extractPersonName(latest.screenshot_text);
                  const appliedName = applyOverride(detectedName, latest.id);
                  const messageDraft =
                    messageRenameDrafts[latest.id] ??
                    messageOverrides[latest.id] ??
                    appliedName;
                  const hasMessageOverride = Boolean(messageOverrides[latest.id]);
                  const lastUpdatedLabel = formatDistanceToNow(new Date(latest.created_at), { addSuffix: true });

                  return (
                    <div
                      key={latest.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Captured {lastUpdatedLabel}</span>
                      </div>
                      <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2 space-y-2">
                        <div className="text-xs text-slate-300">
                              Linked to <span className="text-white font-semibold">{appliedName}</span>
                              <span className="text-slate-500 ml-2">(detected: {detectedName})</span>
                              {hasMessageOverride && <span className="ml-2 text-cyan-300">custom</span>}
                            </div>
                            <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3">
                              <Input
                                value={messageDraft}
                                onChange={(e) =>
                                  setMessageRenameDrafts((prev) => ({
                                    ...prev,
                                    [latest.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 min-w-[140px] max-w-full sm:max-w-[260px] bg-slate-900 border-slate-800 text-white text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                                placeholder="Rename this conversation"
                              />
                              <div className="flex gap-2 justify-end sm:justify-start shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => saveMessageRename(latest, messageDraft)}
                                >
                                  Save
                                </Button>
                                {hasMessageOverride && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-slate-200"
                                    onClick={() => resetMessageRename(latest.id)}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">
                              Screenshot context
                            </div>
                            <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed text-left">
                              {latest.screenshot_text || "No screenshot text available."}
                            </p>
                          </div>

                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">
                              Final output message
                            </div>
                            <div className="text-slate-100 text-sm whitespace-pre-wrap leading-relaxed text-left">
                              {latest.final_reply || latest.generated_reply || "No generated reply yet."}
                            </div>
                          </div>
                    </div>
                  );
                })()
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-300 text-center py-4">
              No conversations found for this person yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
