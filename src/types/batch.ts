export type BatchStatus = "ocr" | "ready" | "needs-draft" | "generating" | "done" | "error";

export type BatchItem = {
  id: string;
  fileName: string;
  imageUrl: string;
  file?: File;
  draft: string;
  tone: string;
  extractedText: string;
  reply: string;
  status: BatchStatus;
  pastHuddles: (import("@/utils/huddlePlayService").HuddlePlay & { similarity?: number })[];
  documents: import("@/types/document").DocumentKnowledge[];
  error?: string;
};
