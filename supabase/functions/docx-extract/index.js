import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import mammoth from "https://esm.sh/mammoth@1.8.0?target=deno";
import { hasAdminRole, requireAuthenticatedUser, } from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { errorResponse, jsonResponse } from "../shared/http.ts";
const MAX_DOCX_BYTES = 20 * 1024 * 1024;
function validateStoragePath(value) {
    if (typeof value !== "string" ||
        !value.toLowerCase().endsWith(".docx") ||
        value.length > 500 ||
        value.includes("..") ||
        value.startsWith("/")) {
        throw new Error("Invalid DOCX storage path");
    }
    return value;
}
serve(async (req) => {
    const preflight = handleCorsPreflight(req);
    if (preflight)
        return preflight;
    if (req.method !== "POST") {
        return jsonResponse(req, { error: "Method not allowed" }, 405);
    }
    try {
        const { user, serviceClient } = await requireAuthenticatedUser(req);
        if (!hasAdminRole(user)) {
            return jsonResponse(req, { error: "Administrator access required", code: "forbidden" }, 403);
        }
        const body = await req.json();
        const fileName = validateStoragePath(body?.fileName);
        const { data: file, error: downloadError } = await serviceClient.storage
            .from("documents")
            .download(fileName);
        if (downloadError) {
            console.error("DOCX download failed", { code: downloadError.name });
            throw new Error("Unable to download DOCX");
        }
        if (file.size > MAX_DOCX_BYTES) {
            return jsonResponse(req, { error: "DOCX file is too large" }, 413);
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = String(result?.value || "").trim();
        if (text.length < 10) {
            throw new Error("DOCX extraction returned insufficient text");
        }
        return jsonResponse(req, {
            text,
            pageCount: 0,
            metadata: {
                originalFileName: fileName,
                processingMethod: "mammoth-raw-text",
                warnings: Array.isArray(result.messages) ? result.messages.length : 0,
            },
        });
    }
    catch (error) {
        return errorResponse(req, error);
    }
});
