export function blobAccess(): "public" | "private" {
  const value = (process.env.BLOB_ACCESS ?? "private").trim().toLowerCase();
  if (value === "public" || value === "private") return value;
  throw new Error('BLOB_ACCESS must be "public" or "private".');
}

export function blobConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID,
  );
}
