import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Loader2,
  MessageSquareText,
  Search,
  X,
} from "lucide-react";
import { useHuddlePlays } from "@/hooks/useHuddlePlays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const HistoryTab = () => {
  const {
    huddlePlays,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    ensureHuddleDetail,
    recordAcceptance,
  } = useHuddlePlays({ paginated: true, light: true, pageSize: 10 });
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleHuddles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return huddlePlays;
    return huddlePlays.filter((huddle) =>
      [
        huddle.user_draft,
        huddle.final_reply,
        huddle.generated_reply,
        huddle.screenshot_text,
      ].some((value) => value?.toLowerCase().includes(normalized)),
    );
  }, [huddlePlays, query]);

  const toggleExpanded = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    await ensureHuddleDetail(id);
    setExpandedId(id);
  };

  const copyReply = async (
    id: string,
    reply: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    await navigator.clipboard.writeText(reply);
    await recordAcceptance(id, null, "copied", reply, {
      source: "history",
    });
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8f5b18] dark:text-[#d5aa67]">
            Reply library
          </p>
          <h2 className="font-display text-2xl leading-tight text-[#29231c] dark:text-[#f4efe7] sm:text-3xl">
            Replies worth reusing
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-[#776b5d] dark:text-[#b4a89a]">
            Revisit what worked, compare your draft with the final reply, and
            copy the best wording in one click.
          </p>
        </div>

        {!isLoading && huddlePlays.length > 0 && (
          <div className="mx-auto flex items-center gap-3 rounded-2xl border border-[#826f56]/15 bg-white/65 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#171513] sm:mx-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c49b5d]/18 text-[#8f5b18] dark:text-[#d5aa67]">
              <MessageSquareText className="h-4 w-4" />
            </span>
            <div className="text-left">
              <p className="text-lg font-semibold leading-none text-[#29231c] dark:text-[#f4efe7]">
                {huddlePlays.length}
                {hasMore ? "+" : ""}
              </p>
              <p className="mt-1 text-xs text-[#776b5d] dark:text-[#b4a89a]">
                saved replies
              </p>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#826f56]/15 bg-white/70 p-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#171513]/90 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#776b5d] dark:text-[#b4a89a]" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your drafts and replies"
            aria-label="Search drafts and replies"
            className="h-11 rounded-xl border-transparent bg-[#f4efe7] pl-10 pr-10 text-[#29231c] shadow-none placeholder:text-[#776b5d] focus-visible:border-[#c49b5d]/40 focus-visible:ring-[#c49b5d]/30 dark:bg-[#0d0c0b] dark:text-[#f4efe7] dark:placeholder:text-[#b4a89a]"
          />
          {query && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1 h-9 w-9 rounded-lg text-[#776b5d] hover:bg-[#c49b5d]/12 hover:text-[#29231c] dark:text-[#b4a89a] dark:hover:text-[#f4efe7]"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!isLoading && (
          <p className="px-2 pb-1 text-center text-xs font-medium text-[#776b5d] dark:text-[#b4a89a] sm:min-w-28 sm:pb-0 sm:text-right">
            {query
              ? `${visibleHuddles.length} ${
                  visibleHuddles.length === 1 ? "match" : "matches"
                }`
              : `${visibleHuddles.length} ${
                  visibleHuddles.length === 1 ? "reply" : "replies"
                } shown`}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-3xl border border-[#826f56]/15 bg-white/60 text-sm text-[#776b5d] dark:border-white/10 dark:bg-[#171513] dark:text-[#b4a89a]">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c49b5d]/15">
            <Loader2 className="h-5 w-5 animate-spin text-[#8f5b18] dark:text-[#d5aa67]" />
          </span>
          Loading your replies…
        </div>
      ) : visibleHuddles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#826f56]/30 bg-white/60 p-12 text-center dark:border-white/10 dark:bg-[#171513]">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c49b5d]/15">
            {query ? (
              <Search className="h-5 w-5 text-[#a97d45] dark:text-[#d5aa67]" />
            ) : (
              <History className="h-5 w-5 text-[#a97d45] dark:text-[#d5aa67]" />
            )}
          </span>
          <p className="font-medium text-[#29231c] dark:text-[#f4efe7]">
            {query ? "No matching replies" : "Your first reply will appear here"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[#776b5d] dark:text-[#b4a89a]">
            {query
              ? "Try a different word or clear the search to see every reply."
              : "Copying or adjusting a reply helps Huddle learn what worked."}
          </p>
          {query && (
            <Button
              variant="outline"
              onClick={() => setQuery("")}
              className="mt-5 rounded-xl border-[#826f56]/20 bg-transparent"
            >
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[#826f56]/15 bg-white/80 shadow-[0_18px_50px_-38px_rgba(77,60,42,0.65)] dark:border-white/10 dark:bg-[#171513]">
          {visibleHuddles.map((huddle) => {
            const reply = huddle.final_reply || huddle.generated_reply || "";
            const expanded = expandedId === huddle.id;
            return (
              <article
                key={huddle.id}
                className="group border-b border-[#826f56]/12 p-4 transition-colors last:border-b-0 hover:bg-[#faf7f1] dark:border-white/[0.07] dark:hover:bg-white/[0.025] sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#776b5d] dark:text-[#b4a89a]">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <time dateTime={huddle.created_at}>
                        {formatDistanceToNow(new Date(huddle.created_at), {
                          addSuffix: true,
                        })}
                      </time>
                    </span>
                    {huddle.final_reply && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#bcefd8]/60 px-2 py-1 font-medium text-[#23684c] dark:bg-[#348f6a]/12 dark:text-[#6ee7b7]">
                        <Check className="h-3 w-3" />
                        Accepted
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={
                      copiedId === huddle.id ? "Reply copied" : "Copy reply"
                    }
                    disabled={!reply}
                    onClick={(event) => copyReply(huddle.id, reply, event)}
                    className="h-9 rounded-xl px-3 text-[#5f5448] hover:bg-[#c49b5d]/14 hover:text-[#29231c] dark:text-[#c7bbae] dark:hover:text-[#f4efe7]"
                  >
                    {copiedId === huddle.id ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-[#348f6a]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-0">
                  <div className="min-w-0 lg:pr-6">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f5b18] dark:text-[#d5aa67]">
                      Your draft
                    </p>
                    <p
                      className={`text-sm leading-relaxed text-[#776b5d] dark:text-[#b4a89a] ${
                        expanded ? "whitespace-pre-wrap" : "line-clamp-3"
                      }`}
                    >
                      {huddle.user_draft || "Draft unavailable"}
                    </p>
                  </div>

                  <div className="min-w-0 border-t border-[#826f56]/12 pt-4 dark:border-white/[0.07] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f5b18] dark:text-[#d5aa67]">
                      Final reply
                    </p>
                    <p
                      className={`text-[15px] leading-7 text-[#29231c] dark:text-[#f4efe7] ${
                        expanded ? "whitespace-pre-wrap" : "line-clamp-3"
                      }`}
                    >
                      {reply || "Reply unavailable"}
                    </p>
                  </div>
                </div>

                {expanded && huddle.screenshot_text && (
                  <div className="mt-4 rounded-2xl bg-[#efe7dc]/75 p-4 text-xs leading-relaxed text-[#6d6255] dark:bg-[#0d0c0b]/70 dark:text-[#b4a89a]">
                    <p className="mb-1.5 font-semibold uppercase tracking-[0.14em] text-[#8f5b18] dark:text-[#d5aa67]">
                      Screenshot context
                    </p>
                    <p className="whitespace-pre-wrap">{huddle.screenshot_text}</p>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(huddle.id)}
                    className="h-8 rounded-lg px-2 text-xs text-[#776b5d] hover:bg-[#c49b5d]/10 hover:text-[#29231c] dark:text-[#b4a89a] dark:hover:text-[#f4efe7]"
                  >
                    {expanded ? (
                      <>
                        Show less
                        <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        View full reply
                        <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore && !query && (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="h-11 w-full rounded-xl border-[#826f56]/20 bg-white/65 text-[#5f5448] hover:bg-white dark:border-white/10 dark:bg-[#171513] dark:text-[#d7cabd] dark:hover:bg-[#201d1a]"
        >
          {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Load more
        </Button>
      )}
    </section>
  );
};
