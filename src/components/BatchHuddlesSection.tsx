import { useMemo, useState } from "react";
import { Upload, Zap, Loader2, Copy, RefreshCcw, Check } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sanitizeHumanReply } from "@/utils/sanitizeHumanReply";
import type { DocumentKnowledge } from "@/types/document";
import type { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { BatchItem, BatchStatus } from "@/types/batch";
import type {
  HuddleAcceptanceEvent,
  PastHuddleReference,
} from "@/utils/huddlePlayService";

type ToastFn = ReturnType<typeof useToast>["toast"];

const statusCopy: Record<BatchStatus, string> = {
  ocr: "Extracting text...",
  ready: "Ready to draft",
  "needs-draft": "Add a draft to continue",
  generating: "Generating reply...",
  done: "Reply ready",
  error: "Needs attention",
};

const toneOptions = [
  { value: "none", label: "Original tone" },
  { value: "warm", label: "Warmer" },
  { value: "friendly", label: "More friendly" },
  { value: "casual", label: "More casual" },
  { value: "professional", label: "More professional" },
  { value: "direct", label: "More direct" },
];

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fallbackScreenshotText =
  "Describe what you see in the screenshot or paste context from the huddle so we can tailor the reply.";

const BATCH_LIMIT = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BatchHuddlesSectionProps {
  extractText: (file: File) => Promise<string>;
  generateReply: (
    screenshotText: string,
    userDraft: string,
    isRegeneration?: boolean,
    existingDocumentKnowledge?: DocumentKnowledge[],
    existingPastHuddles?: PastHuddleReference[],
    onToken?: (
      partial: string,
      options?: { slangAddressTerms?: string[] }
    ) => void,
    huddleId?: string | null,
    parentGenerationId?: string | null,
  ) => Promise<{
    reply: string;
    huddleId?: string;
    generationId?: string;
    pastHuddles?: PastHuddleReference[];
    documentKnowledge?: DocumentKnowledge[];
    slangAddressTerms?: string[];
  } | null>;
  adjustTone: (reply: string, selectedTone: string) => Promise<string | null>;
  toast: ToastFn;
  isAdjustingTone: boolean;
  batchItems: BatchItem[];
  setBatchItems: React.Dispatch<React.SetStateAction<BatchItem[]>>;
  recordAcceptance: (
    huddlePlayId: string,
    generationId: string | null,
    eventType: HuddleAcceptanceEvent,
    finalReply: string,
    metadata?: Record<string, string | number | boolean | null>,
  ) => Promise<boolean>;
}

export const BatchHuddlesSection = ({
  extractText,
  generateReply,
  adjustTone,
  toast,
  isAdjustingTone,
  batchItems,
  setBatchItems,
  recordAcceptance,
}: BatchHuddlesSectionProps) => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const canAddMore = batchItems.length < BATCH_LIMIT;
  const totalReady = batchItems.filter(
    (i) => i.status === "ready" || i.status === "needs-draft"
  ).length;
  const completed = batchItems.filter((i) => i.status === "done").length;

  const onDrop = async (accepted: File[]) => {
    const availableSlots = Math.max(0, BATCH_LIMIT - batchItems.length);
    const files = accepted.slice(0, availableSlots);
    if (!files.length) return;

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const imageUrl = await fileToDataUrl(file);
      const fileName = file.name || "screenshot";

      const next: BatchItem = {
        id,
        fileName,
        imageUrl,
        file,
        draft: "",
        tone: "none",
        extractedText: "",
        reply: "",
        status: "ocr",
        pastHuddles: [],
        documents: [],
      };

      setBatchItems((prev) => [...prev, next]);
      setActiveId((prev) => prev ?? id);
      runOCR(id, file);
    }
  };

  const runOCR = async (id: string, file: File) => {
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "ocr", error: undefined } : item
      )
    );

    try {
      const text = await extractText(file);
      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                extractedText: text,
                status: text ? "ready" : "needs-draft",
                error: undefined,
              }
            : item
        )
      );
    } catch (error) {
      console.error("Batch OCR failed", error);
      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "error", error: "OCR failed" }
            : item
        )
      );
      toast({
        title: "OCR failed",
        description: "Retry or upload a clearer screenshot.",
        variant: "destructive",
      });
    }
  };

  const updateItem = (id: string, updater: (item: BatchItem) => BatchItem) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? updater(item) : item))
    );
  };

  const handleDraftChange = (id: string, draft: string) => {
    updateItem(id, (item) => ({
      ...item,
      draft,
      status:
        item.status === "needs-draft" && draft.trim() ? "ready" : item.status,
    }));
  };

  const runGeneration = async (id: string, isRegeneration = false) => {
    const target = batchItems.find((i) => i.id === id);
    if (!target) return;

    if (isRegeneration && target.status === "generating") {
      toast({
        title: "Please wait",
        description:
          "This huddle is already generating. Try again in a moment.",
      });
      return;
    }

    if (!target.draft.trim()) {
      toast({
        title: "Draft required",
        description: "Add a draft message before generating.",
        variant: "destructive",
      });
      updateItem(id, (item) => ({ ...item, status: "needs-draft" }));
      return;
    }
    if (target.draft.trim().toLowerCase() === "test") {
      toast({
        title: "Add a real draft",
        description: "Write a short version of what you want to say.",
        variant: "destructive",
      });
      updateItem(id, (item) => ({ ...item, status: "needs-draft" }));
      return;
    }

    const screenshotText = target.extractedText || fallbackScreenshotText;

    updateItem(id, (item) => ({
      ...item,
      status: "generating",
      reply: isRegeneration ? item.reply : "",
      error: undefined,
    }));

    let latestSlangTerms: string[] | undefined;
    const result = await generateReply(
      screenshotText,
      target.draft,
      isRegeneration,
      target.documents,
      target.pastHuddles,
      (partial, meta) => {
        if (meta?.slangAddressTerms?.length) {
          latestSlangTerms = meta.slangAddressTerms;
        }
        updateItem(id, (item) => ({
          ...item,
          reply: sanitizeHumanReply(partial, {
            slangAddressTerms: latestSlangTerms,
          }),
        }));
      },
      target.huddleId,
      target.generationId,
    );

    if (!result) {
      updateItem(id, (item) => ({
        ...item,
        status: "error",
        error: "Generation failed",
      }));
      toast({
        title: "Generation failed",
        description: "Try again or adjust the draft.",
        variant: "destructive",
      });
      return;
    }

    const slangTerms = result.slangAddressTerms || latestSlangTerms;
    const cleanReply = sanitizeHumanReply(result.reply, {
      slangAddressTerms: slangTerms,
    });

    updateItem(id, (item) => ({
      ...item,
      reply: cleanReply,
      huddleId: result.huddleId || item.huddleId,
      generationId: result.generationId || item.generationId,
      status: "done",
      pastHuddles: result.pastHuddles || [],
      documents: result.documentKnowledge || [],
    }));
    toast({
      title: "Reply ready",
      description: `Used ${result.pastHuddles?.length || 0} huddles and ${
        result.documentKnowledge?.length || 0
      } docs.`,
    });
  };

  const handleGenerateAll = async () => {
    if (!batchItems.length) return;
    setIsRunningAll(true);
    for (const item of batchItems) {
      if (item.status === "done" || item.status === "generating") continue;
      await runGeneration(item.id, false);
      await wait(800); // brief pause to let streaming finish before moving to the next huddle
    }
    setIsRunningAll(false);
  };

  const handleAdjustTone = async (id: string) => {
    const target = batchItems.find((i) => i.id === id);
    if (!target || !target.reply || target.tone === "none") return;

    updateItem(id, (item) => ({ ...item, status: "generating" }));
    const adjusted = await adjustTone(target.reply, target.tone);
    const cleanAdjusted = sanitizeHumanReply(adjusted || target.reply);
    updateItem(id, (item) => ({
      ...item,
      reply: cleanAdjusted,
      status: "done",
    }));
    if (target.huddleId) {
      await recordAcceptance(
        target.huddleId,
        target.generationId || null,
        "tone_applied",
        cleanAdjusted,
        { tone: target.tone },
      );
    }
    toast({
      title: "Tone applied",
      description: `Updated with ${target.tone} tone.`,
    });
  };

  const handleCopy = async (item: BatchItem) => {
    try {
      await navigator.clipboard.writeText(item.reply);
      if (item.huddleId) {
        await recordAcceptance(
          item.huddleId,
          item.generationId || null,
          "copied",
          item.reply,
        );
      }
      toast({ title: "Copied!", description: "Reply copied to clipboard." });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setBatchItems([]);
    setActiveId(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    multiple: true,
    maxFiles: BATCH_LIMIT,
    disabled: !canAddMore,
  });

  const activeItem = useMemo(
    () => batchItems.find((i) => i.id === activeId) || batchItems[0],
    [batchItems, activeId]
  );

  return (
    <div className="space-y-4">
      <Card className="border-[#826f56]/15 bg-white/90 dark:border-white/10 dark:bg-[#151513] glass-surface">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-[#c49b5d] bg-[#c49b5d]/10"
                : "border-[#826f56]/25 dark:border-white/15"
            } ${
              !canAddMore
                ? "cursor-not-allowed opacity-60"
                : "hover:border-[#c49b5d] hover:bg-[#c49b5d]/10"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3 text-[#29231c] dark:text-[#f4efe7]">
              <div className="h-12 w-12 rounded-full bg-[#c49b5d]/15 flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#a97d45] dark:text-[#d5aa67]" />
              </div>
              <div>
                <p className="text-lg font-display">
                  Drop up to {BATCH_LIMIT} huddle screenshots
                </p>
              </div>
              <div className="px-4 py-2 rounded-full bg-[#c49b5d] text-sm text-[#071326]">
                {canAddMore ? "Select images" : "Batch full"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Badge className="border border-[#b9cbe5] bg-[#eaf1fa] text-[#2f5d8c] dark:border-[#355981] dark:bg-[#102033] dark:text-[#7ea4d6]">
              Queue {batchItems.length}/{BATCH_LIMIT}
            </Badge>
            <Badge className="border border-[#348f6a]/30 bg-[#bcefd8]/70 text-[#23684c] dark:bg-[#348f6a]/10 dark:text-[#6ee7b7]">
              Done {completed}
            </Badge>
            <Badge className="border border-[#c49b5d]/30 bg-[#c49b5d]/15 text-[#8f5b18] dark:text-[#d5aa67]">
              Ready {totalReady}
            </Badge>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleGenerateAll}
              disabled={!batchItems.length || isRunningAll}
              className="bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52]"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate all
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-[#826f56]/15 bg-white/80 text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f4efe7] dark:hover:bg-white/[0.08]"
            >
              Reset batch
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {batchItems.map((item, index) => (
          <Card
            key={item.id}
            className={`bg-white/90 dark:bg-[#151513] border ${
              activeItem?.id === item.id
                ? "border-[#c49b5d]/50"
                : "border-[#826f56]/15 dark:border-white/10"
            } glass-surface`}
            onClick={() => setActiveId(item.id)}
          >
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="grid gap-4 lg:grid-cols-[minmax(360px,520px)_1fr] items-start">
                <div className="space-y-2">
                  <div className="relative w-full bg-[#fffcf7] border border-[#826f56]/15 rounded-2xl overflow-hidden shadow-inner dark:border-white/10 dark:bg-[#0d0c0b]">
                    <div className="absolute top-2 left-2">
                      <Badge className="border-[#c49b5d]/30 bg-[#071326] text-[#f4efe7]">
                        {index + 1}
                      </Badge>
                    </div>
                    <img
                      src={item.imageUrl}
                      alt={item.fileName}
                      className="w-full h-full object-contain max-h-[520px] sm:max-h-[560px] bg-[#fffcf7] dark:bg-[#0d0c0b]"
                    />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="border border-[#826f56]/15 bg-white/90 text-[#29231c] dark:border-white/10 dark:bg-[#171513] dark:text-[#f4efe7]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(item.imageUrl);
                        }}
                      >
                        View full
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <Textarea
                    value={item.draft}
                    onChange={(e) => handleDraftChange(item.id, e.target.value)}
                    placeholder="Draft your intent for this huddle..."
                    rows={3}
                    className="border-[#826f56]/15 bg-[#fffcf7] text-[#29231c] placeholder:text-[#776b5d] focus-visible:ring-[#c49b5d]/50 dark:border-white/10 dark:bg-[#0d0c0b]/70 dark:text-[#f4efe7] dark:placeholder:text-[#b4a89a]"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => runGeneration(item.id, false)}
                      disabled={
                        item.status === "ocr" || item.status === "generating"
                      }
                      className="bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52]"
                    >
                      {item.status === "generating" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Working...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Generate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => runGeneration(item.id, true)}
                      disabled={
                        item.status === "ocr" ||
                        item.status === "generating" ||
                        !item.reply
                      }
                      className="border-[#826f56]/15 bg-white/80 text-[#29231c] hover:bg-[#efe7dc] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f4efe7]"
                    >
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <Select
                        value={item.tone}
                        onValueChange={(val) =>
                          updateItem(item.id, (curr) => ({
                            ...curr,
                            tone: val,
                          }))
                        }
                        disabled={!item.reply || isAdjustingTone}
                      >
                        <SelectTrigger className="w-full border-[#826f56]/15 bg-[#fffcf7] text-[#29231c] dark:border-white/10 dark:bg-[#0d0c0b]/70 dark:text-[#f4efe7]">
                          <SelectValue placeholder="Tone" />
                        </SelectTrigger>
                        <SelectContent className="border-[#826f56]/15 bg-[#fffcf7] text-[#29231c] dark:border-white/10 dark:bg-[#171513] dark:text-[#f4efe7]">
                          {toneOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-[#29231c] dark:text-[#f4efe7]"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        onClick={() => handleAdjustTone(item.id)}
                        disabled={
                          !item.reply || item.tone === "none" || isAdjustingTone
                        }
                        className="border-[#c49b5d] bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52] w-full"
                      >
                        {isAdjustingTone ? "Adjusting..." : "Apply tone"}
                      </Button>
                    </div>
                    <div className="flex justify-center col-span-2">
                      <Button
                        variant="ghost"
                        onClick={() => handleCopy(item)}
                        disabled={!item.reply}
                        className="text-[#29231c] hover:bg-[#efe7dc] w-full dark:text-[#f4efe7] dark:hover:bg-white/[0.08]"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  {item.reply && (
                    <div className="bg-[#fffcf7] border border-[#826f56]/15 rounded-xl p-3 text-sm text-[#29231c] leading-relaxed dark:border-white/10 dark:bg-[#0d0c0b]/70 dark:text-[#f4efe7]">
                      <div className="flex items-center gap-2 text-xs text-[#23684c] mb-2 dark:text-[#6ee7b7]">
                        <Check className="w-4 h-4" />
                        Reply ready
                      </div>
                      <pre className="whitespace-pre-wrap font-sans">
                        {item.reply}
                      </pre>
                      {(item.pastHuddles.length > 0 ||
                        item.documents.length > 0) && (
                        <p className="mt-2 text-xs text-[#776b5d] dark:text-[#b4a89a]">
                          Sources: {item.pastHuddles.length} huddles •{" "}
                          {item.documents.length} docs
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Dialog
          open={!!previewImage}
          onOpenChange={(open) => !open && setPreviewImage(null)}
        >
          <DialogContent className="max-w-5xl border-[#826f56]/15 bg-[#fffcf7] dark:border-white/10 dark:bg-[#171513]">
            {previewImage && (
              <img
                src={previewImage}
                alt="Screenshot preview"
                className="w-full h-full object-contain max-h-[82vh]"
              />
            )}
          </DialogContent>
        </Dialog>

        {!batchItems.length && (
          <Card className="border-[#826f56]/15 bg-white/80 dark:border-white/10 dark:bg-[#151513] glass-surface">
            <CardContent className="p-6 text-center text-[#776b5d] dark:text-[#b4a89a]">
              Drop multiple screenshots to queue huddles and generate replies in
              one pass.
            </CardContent>
          </Card>
        )}

        {batchItems.length > 0 && (
          <div className="flex justify-center">
            <Button
              onClick={handleGenerateAll}
              disabled={!batchItems.length || isRunningAll}
              className="bg-[#c49b5d] text-[#071326] hover:bg-[#b58a52]"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Generate all
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
