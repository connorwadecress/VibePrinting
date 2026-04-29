/**
 * DELETE /api/library/[kind]/[filename]
 *
 * Removes a single file from the shared library. Filename is sanitized
 * via path.basename in shared-library.ts, so traversal attempts return
 * 400 rather than escaping the library dir.
 *
 * Note: we intentionally do NOT scrub the AssetEntry[] in any
 * channel.json — that pre-existing per-brand allowlist already shows
 * the row as "missing" once the file is gone, with a one-click
 * remove-orphan in the brand editor.
 */

import { requireAuth } from "@/lib/auth";
import { isLibraryKind, deleteLibraryFile } from "@/lib/shared-library";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ kind: string; filename: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { kind, filename } = await context.params;
  if (!isLibraryKind(kind)) {
    return new Response(JSON.stringify({ error: "kind must be 'gameplay' or 'music'" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Next URL-decodes [filename] for us, so spaces and special chars come
  // through verbatim — but we still re-sanitize inside deleteLibraryFile.
  const removed = deleteLibraryFile(kind, filename);
  if (!removed) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, kind, filename }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
