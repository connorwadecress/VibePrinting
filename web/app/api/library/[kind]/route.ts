/**
 * GET  /api/library/[kind]   — list shared library entries (gameplay | music)
 * POST /api/library/[kind]   — multipart upload, one file per request
 *
 * The shared library is cross-brand on purpose: every authenticated user
 * on the instance can list and modify it. Per-brand customization is
 * the AssetEntry[] allowlist on each channel.json, edited elsewhere.
 *
 * Auth: any logged-in user (no per-brand check — the library is shared).
 *       Token verification still happens via requireAuth.
 */

import { requireAuth } from "@/lib/auth";
import {
  isLibraryKind,
  listLibrary,
  writeLibraryUpload,
  MAX_UPLOAD_BYTES,
  allowedExtsFor,
} from "@/lib/shared-library";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ kind: string }>;
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { kind } = await context.params;
  if (!isLibraryKind(kind)) return badRequest("kind must be 'gameplay' or 'music'");

  const entries = listLibrary(kind);
  return new Response(
    JSON.stringify({
      kind,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      allowedExtensions: allowedExtsFor(kind),
      entries,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { kind } = await context.params;
  if (!isLibraryKind(kind)) return badRequest("kind must be 'gameplay' or 'music'");

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return badRequest("expected multipart/form-data with a 'file' field");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return badRequest(`could not parse form data: ${(err as Error).message}`);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return badRequest("missing 'file' field in form data");
  }

  try {
    const result = await writeLibraryUpload(kind, file);
    return new Response(
      JSON.stringify({ ok: true, ...result, kind }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (msg === "invalid_filename") {
      return badRequest(
        `Filename rejected. Allowed extensions: ${allowedExtsFor(kind).join(", ")}.`,
      );
    }
    if (msg === "file_too_large") {
      return new Response(
        JSON.stringify({
          error: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit.`,
        }),
        { status: 413, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
