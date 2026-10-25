# Brisbins Inventory

Warehouse stock dashboard for Brisbins. The page reads the latest upload from Vercel Blob and falls back to the seeded stocktake in `data/inventory.json` when Blob is empty or not configured yet.

The office spreadsheet stays the source of truth. A script on the office PC posts the exported JSON here; the dashboard does not write to the serverless filesystem.

## Local

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Blob env vars, the page shows the seeded file (109 SKUs).

```bash
npm test
npm run build
```

## Deploy on Vercel

1. Import this repo. Framework is Next.js (`vercel.json`).
2. Create a **private** Blob store and connect it to the project. Private storage lets the dashboard read the latest overwrite immediately.
3. Set the env vars below for Production (and Preview, if the office script should update previews).
4. Redeploy after saving env vars. Vercel does not apply new env vars to an existing deployment.

Until the first successful upload, the live site shows `data/inventory.json`.

## Environment

| Name | Required | Purpose |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Yes, for token-based stores | Read-write token from the connected Blob store. Newer private stores may inject `BLOB_STORE_ID` and use OIDC instead; the SDK accepts either. |
| `BLOB_ACCESS` | No | `private` (default) or `public`. Must match the store. Use `private`. |
| `INVENTORY_UPDATE_SECRET` | Yes, to accept uploads | Long random string. Send it as `Authorization: Bearer <secret>`. |

Copy `.env.example` to `.env.local` for local Blob trials. Do not commit secrets.

## Push an update

`POST /api/inventory/update` replaces the blob `inventory.json`. The body is the same shape as `data/inventory.json`:

```json
{
  "updated_at": "2026-10-23T14:21:56",
  "source": "Brisbins_Current_Inventory.xlsx",
  "meta": { "title": "", "date": "", "counted_by": "", "generated": "", "grand_total": 4983 },
  "items": [
    {
      "category": "Bin",
      "item": "100L Bin Black",
      "sku": "100L-BIN-BLACK",
      "color": "Black",
      "size": "100L",
      "total_count": 13,
      "locations": ""
    }
  ]
}
```

`updated_at` without a timezone is shown as wall-clock time (not shifted into another zone). `locations` may be a string or an object of place → count.

`total_count` and `meta.grand_total` are whole numbers from -1,000,000 to 1,000,000. Decimals are rounded. A negative count is a backorder; zero is out of stock. The headline on-hand figure is `meta.grand_total` when the sheet sends one (the office total, for example 4,983), and otherwise the sum of `total_count`.

The stock matrix groups wheelie bins and lids by colour and size. 80L and 120L lids are pooled into one 80/120L column. Pedal bins, vermin lids, flip tops, and dome bins have their own panels. A line that does not match those groups is listed under Other lines. Counts of 1–5 are reorder, and 6–15 are running low.

```bash
curl -X POST "$APP_URL/api/inventory/update" \
  -H "Authorization: Bearer $INVENTORY_UPDATE_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @data/inventory.json
```

A successful post returns `{ "ok": true, "items", "grand_total", "sheet_total", "updated_at" }`. `grand_total` in that response is still the sum of line counts. `sheet_total` is `meta.grand_total`.

`GET /api/inventory` returns the current JSON (`Cache-Control: no-store`): Blob when the object exists, otherwise the seeded file.

## Routes

- `/` — stock matrix
- `GET /api/inventory` — current stock JSON
- `POST /api/inventory/update` — replace stock in Blob
