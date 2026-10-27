import { bearerAuthorised } from "@/lib/auth";
import { blobConfigured } from "@/lib/blob-config";
import { parseHistory } from "@/lib/history";
import { saveHistory } from "@/lib/store";

const MAX_BODY_BYTES = 8_000_000;

export async function POST(request: Request) {
  const secret = process.env.INVENTORY_UPDATE_SECRET;
  if (!secret) {
    return jsonError(503, "INVENTORY_UPDATE_SECRET is not set.");
  }

  if (!bearerAuthorised(request.headers.get("authorization"), secret)) {
    return jsonError(401, "Unauthorised.");
  }

  const rawLength = request.headers.get("content-length");
  if (rawLength) {
    const contentLength = Number(rawLength);
    if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
      return jsonError(413, "History payload is too large.");
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "Content-Type must be application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "History payload is not valid JSON.");
  }

  const parsed = parseHistory(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.error);
  }

  if (!blobConfigured()) {
    return jsonError(
      503,
      "Blob store is not configured. Set BLOB_READ_WRITE_TOKEN or connect a Blob store.",
    );
  }

  try {
    await saveHistory(body);
  } catch (error) {
    console.error(
      "Blob write failed:",
      error instanceof Error ? error.message : error,
    );
    const message =
      error instanceof Error && error.message.includes("BLOB_ACCESS")
        ? error.message
        : "Could not write history.json to Blob.";
    return jsonError(502, message);
  }

  return Response.json(
    {
      ok: true,
      pathname: "history.json",
      schema_version: parsed.value.schemaVersion,
      months: parsed.value.months.length,
      days: parsed.value.days.length,
      generated_at: parsed.value.generatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function jsonError(status: number, error: string) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
