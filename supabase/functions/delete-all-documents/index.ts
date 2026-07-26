import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  hasAdminRole,
  requireAuthenticatedUser,
} from "../shared/auth.ts";
import { handleCorsPreflight } from "../shared/cors.ts";
import { errorResponse, jsonResponse } from "../shared/http.ts";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);
    if (!hasAdminRole(user)) {
      return jsonResponse(
        req,
        { error: "Administrator access required", code: "forbidden" },
        403,
      );
    }
    const body = await req.json().catch(() => ({}));
    const documentName =
      typeof body?.documentName === "string"
        ? body.documentName.trim()
        : "";
    if (documentName.length > 500) {
      return jsonResponse(req, { error: "Invalid document name" }, 400);
    }

    let deleteQuery = serviceClient
      .from("document_knowledge")
      .delete();
    deleteQuery = documentName
      ? deleteQuery.eq("document_name", documentName)
      : deleteQuery.not("id", "is", null);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error("Unable to delete document knowledge", {
        code: deleteError.code,
      });
      throw new Error("Unable to delete documents");
    }
    if (documentName) {
      return jsonResponse(req, { success: true });
    }

    const { data: files, error: listError } = await serviceClient.storage
      .from("documents")
      .list("", { limit: 1_000 });
    if (listError) {
      console.warn("Unable to list stored documents during cleanup", {
        code: listError.name,
      });
    } else if (files?.length) {
      const paths = files
        .filter((file: { id?: string | null }) => Boolean(file.id))
        .map((file: { name: string }) => file.name);
      if (!paths.length) {
        return jsonResponse(req, { success: true });
      }
      const { error: storageError } = await serviceClient.storage
        .from("documents")
        .remove(paths);
      if (storageError) {
        console.warn("Unable to remove all stored document files", {
          code: storageError.name,
        });
      }
    }

    return jsonResponse(req, { success: true });
  } catch (error) {
    return errorResponse(req, error);
  }
});
