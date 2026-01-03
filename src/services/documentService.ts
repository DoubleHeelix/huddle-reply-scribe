import { encode } from "gpt-tokenizer";
import { supabase } from "@/integrations/supabase/client";
import { DocumentSummary } from "@/types/document";
import { pdfProcessor } from "./pdfProcessor";
import { markerChunksToUploadStrict, tokenCount } from "./markdownPreprocessor";

type ExtractedDocument = {
  text: string;
  pageCount: number;
  metadata: Record<string, unknown>;
};

export const documentService = {
  async fetchDocuments(): Promise<DocumentSummary[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("document_knowledge")
      .select("document_name, processed_at")
      .eq("user_id", user.id);

    if (error) throw error;

    const documentMap = new Map<
      string,
      { processed_at: string; chunks: number }
    >();

    data.forEach((item) => {
      if (documentMap.has(item.document_name)) {
        documentMap.get(item.document_name)!.chunks++;
      } else {
        documentMap.set(item.document_name, {
          processed_at: item.processed_at,
          chunks: 1,
        });
      }
    });

    return Array.from(documentMap.entries()).map(([name, info]) => ({
      document_name: name,
      chunks: info.chunks,
      processed_at: info.processed_at,
    }));
  },

  async processDocumentFromStorage(
    fileName: string
  ): Promise<{ success: boolean; chunks_processed: number }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const sourceType = this.getSourceType(fileName);

    try {
      console.log("📄 Starting processing for:", fileName);

      // 1) Extract raw text
      const {
        text,
        pageCount,
        metadata: extractionMetadata,
      } = await this.extractTextFromStorage(fileName, sourceType);

      if (!text || text.length < 20) {
        throw new Error("Could not extract sufficient text from document.");
      }

      // Debug: confirm markers exist in extracted text
      const markerCount = (text.match(/---\s*CHUNK\s*\d+\s*---/gi) || [])
        .length;
      console.log("MARKER_MATCH_COUNT", markerCount);
      console.log("MARKER_PROBE", JSON.stringify(text.slice(0, 500)));

      // 2) STRICT: one row per marker
      const markerChunks = markerChunksToUploadStrict(text);

      console.log(`🧩 Marker chunks to upload: ${markerChunks.length}`);

      // 3) Upload each marker chunk as its own DB row
      for (let i = 0; i < markerChunks.length; i++) {
        const item = markerChunks[i];

        const preview = item.content.slice(0, 200);
        console.log(
          `➡️ Uploading CHUNK ${item.markerIndex}. tokenCount=${tokenCount(
            item.content
          )} preview=${JSON.stringify(preview)}`
        );

        const { error } = await supabase.functions.invoke("create-embedding", {
          body: {
            document_name: fileName,
            extracted_text: item.content, // EXACTLY one marker chunk
            user_id: user.id,
            is_chunked: true,

            // Store the source marker number here:
            chunk_index: item.markerIndex,

            // Total marker chunks:
            total_chunks: markerChunks.length,

            metadata: {
              ...extractionMetadata,
              pageCount,
              processingMethod: "marker-chunked-processing-strict",
              sourceType,
              canonicalFormat: "markdown",
              preprocessingVersion: "v5-inline-marker-split",
              sourceChunkNumber: item.markerIndex,
              tokenCount: encode(item.content).length,
            },
          },
        });

        if (error) {
          throw new Error(
            `Failed uploading CHUNK ${item.markerIndex}: ${error.message}`
          );
        }
      }

      console.log("✅ All marker chunks processed successfully");
      return { success: true, chunks_processed: markerChunks.length };
    } catch (error) {
      console.error("❌ Document processing error:", error);
      throw error;
    }
  },

  getSourceType(fileName: string): "pdf" | "docx" {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".pdf")) return "pdf";
    if (lower.endsWith(".docx")) return "docx";
    throw new Error(
      `Unsupported document type for ${fileName}. Only PDF and DOCX are supported.`
    );
  },

  async extractTextFromStorage(
    fileName: string,
    sourceType: "pdf" | "docx"
  ): Promise<ExtractedDocument> {
    if (sourceType === "pdf") {
      const { text, pageCount, metadata } =
        await pdfProcessor.extractTextFromStorage(fileName);
      return { text, pageCount, metadata: metadata || {} };
    }

    // DOCX: delegate to an edge function
    const { data, error } = await supabase.functions.invoke("docx-extract", {
      body: { fileName },
    });

    if (error) throw new Error(`DOCX extraction failed: ${error.message}`);

    const text = data?.text as string | undefined;
    const pageCount = (data?.pageCount as number | undefined) ?? 0;
    const metadata =
      (data?.metadata as Record<string, unknown> | undefined) ?? {};

    if (!text || text.length < 10) {
      throw new Error("DOCX extraction returned insufficient text.");
    }

    return { text, pageCount, metadata };
  },

  async deleteDocument(documentName: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("document_knowledge")
      .delete()
      .eq("user_id", user.id)
      .eq("document_name", documentName);

    if (error) throw error;
  },

  async deleteAllDocuments(): Promise<void> {
    const { error } = await supabase.functions.invoke("delete-all-documents", {
      method: "POST",
    });

    if (error) throw new Error(`Failed to delete documents: ${error.message}`);
  },
};
