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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowLeftRight, Columns3, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Input as ShadInput } from "@/components/ui/input";
import { useHuddlePlays } from "@/hooks/useHuddlePlays";
import { extractPersonName } from "@/utils/extractPersonName";
import {
  getPeopleOverrides,
  savePeopleOverrides,
  getHuddlePersonOverrides,
  saveHuddlePersonOverride,
  clearHuddlePersonOverride,
  type HuddlePlay,
} from "@/utils/huddlePlayService";
import { formatDistanceToNow } from "date-fns";

type ColumnId = string;
type Mode = "convo" | "process";

const STORAGE_KEY = "trello_board_state";

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
  const { huddlePlays } = useHuddlePlays();
  const [mode, setMode] = useState<Mode>("convo");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [messageOverrides, setMessageOverrides] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [messageRenameDrafts, setMessageRenameDrafts] = useState<Record<string, string>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<ColumnId, boolean>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      const last = Math.max(...value.huddles.map((h) => new Date(h.created_at).getTime()));
      entries.push({ name: key, last });
    });
    entries.sort((a, b) => b.last - a.last);
    return entries;
  }, [groupedByName]);

  const lastChattedByName = useMemo(() => {
    const map = new Map<string, string>();
    groupedByName.forEach((value, key) => {
      const last = Math.max(...value.huddles.map((h) => new Date(h.created_at).getTime()));
      if (isFinite(last)) {
        map.set(key, formatDistanceToNow(new Date(last), { addSuffix: true }));
      }
    });
    return map;
  }, [groupedByName]);

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
    if (!q) return board;
    const next: BoardState = {};
    Object.keys(board).forEach((col) => {
      next[col] = (board[col] || []).filter((name) => name.toLowerCase().includes(q));
    });
    return next;
  }, [board, searchQuery]);

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

      boardRef[column] = [...(boardRef[column] || []), value];
      persistBoards(next);
      return next;
    });
    setDrafts((prev) => ({ ...prev, [column]: "" }));
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

  const removeName = (column: ColumnId, index: number) => {
    setBoards((prev) => {
      const next: BoardByMode = {
        convo: prev.convo ? { ...prev.convo } : createEmptyBoard(columnSets.convo),
        process: prev.process ? { ...prev.process } : createEmptyBoard(columnSets.process),
      };
      const current = next[mode];
      columnSets[mode].forEach((col) => {
        if (!current[col.id]) current[col.id] = [];
      });
      current[column] = (current[column] || []).filter((_, i) => i !== index);
      persistBoards(next);
      return next;
    });
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
          boardRef[colId] = (boardRef[colId] || []).filter((name) => name !== entry);
        });
      });

      // Add to target
      nextBoards[targetMode][to] = [...(nextBoards[targetMode][to] || []), entry];

      persistBoards(nextBoards);
      return nextBoards;
    });
  };

  const clearBoard = () => {
    const cols = columnSets[mode];
    setBoards((prev) => ({ ...prev, [mode]: createEmptyBoard(cols) }));
    setDrafts(
      cols.reduce((acc, col) => ({ ...acc, [col.id]: "" }), {} as Record<ColumnId, string>)
    );
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-3 py-1 text-xs text-slate-200">
        <Columns3 className="h-4 w-4 text-cyan-300" />
        Trello-style board for quick sorting
      </div>

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

      <div className="flex justify-center gap-3 pt-2">
        <Button
                  variant={mode === "convo" ? "default" : "outline"}
                  onClick={() => setMode("convo")}
                  className={mode === "convo" ? "bg-cyan-600 text-white" : "border-slate-700 bg-slate-900 text-slate-200"}
                >
                  Convo
        </Button>
        <Button
          variant={mode === "process" ? "default" : "outline"}
          onClick={() => setMode("process")}
                  className={mode === "process" ? "bg-cyan-600 text-white" : "border-slate-700 bg-slate-900 text-slate-200"}
                >
                  Process
                </Button>
              </div>

      <div className="max-w-3xl mx-auto">
        <ShadInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search names across columns"
          className="bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {columns.map((column) => {
          const isCollapsed = collapsed[column.id] ?? false;
          return (
            <Card key={column.id} className="border-slate-800/70 bg-slate-900/70 backdrop-blur">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  {column.label}
                  <button
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [column.id]: !isCollapsed }))
                    }
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
              <p className="text-sm text-slate-400">{column.description}</p>
            </CardHeader>

            <CardContent className="space-y-3">
              {!isCollapsed && (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={drafts[column.id] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [column.id]: e.target.value }))}
                      placeholder="Add a name"
                      className="bg-slate-950/80 text-white placeholder:text-slate-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addName(column.id);
                        }
                      }}
                    />
                    <Button type="button" onClick={() => addName(column.id)} className="shrink-0">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(filteredBoard[column.id] || []).length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/70 px-3 py-4 text-center text-sm text-slate-500">
                        Nothing here yet. Add the first name.
                      </div>
                    )}

                    {(filteredBoard[column.id] || []).map((name, idx) => (
                      <div
                        key={`${column.id}-${idx}-${name}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-white shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <button
                            className="truncate text-left hover:text-cyan-200 w-full"
                            onClick={() => setSelectedName(name)}
                          >
                            {name}
                          </button>
                          {lastChattedByName.get(name) && (
                            <div className="text-[11px] text-slate-400 truncate">
                              Last chatted about {lastChattedByName.get(name)}
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
                            onClick={() => removeName(column.id, idx)}
                            className="h-8 w-8 text-rose-200 hover:bg-rose-900/40 hover:text-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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
                {selectedGroup.huddles.length} conversation{selectedGroup.huddles.length === 1 ? "" : "s"}
              </p>

              {selectedGroup.huddles
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
                          className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-3"
                        >
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">
                              Screenshot context
                            </div>
                            <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed text-left">
                              {huddle.screenshot_text || "No screenshot text available."}
                            </p>
                          </div>

                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">
                              Final output message
                            </div>
                            <div className="text-slate-100 text-sm whitespace-pre-wrap leading-relaxed text-left">
                              {huddle.final_reply || huddle.generated_reply || "No generated reply yet."}
                            </div>
                          </div>

                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2 space-y-2">
                            <div className="text-xs text-slate-300">
                          Linked to <span className="text-white font-semibold">{appliedName}</span>
                          <span className="text-slate-500 ml-2">(detected: {detectedName})</span>
                          {hasMessageOverride && <span className="ml-2 text-cyan-300">custom</span>}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={messageDraft}
                            onChange={(e) =>
                              setMessageRenameDrafts((prev) => ({
                                ...prev,
                                [huddle.id]: e.target.value,
                              }))
                            }
                            className="bg-slate-900 border-slate-800 text-white text-xs"
                            placeholder="Rename this conversation"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={() => saveMessageRename(huddle, messageDraft)}
                            >
                              Save
                            </Button>
                            {hasMessageOverride && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-slate-200"
                                onClick={() => resetMessageRename(huddle.id)}
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
