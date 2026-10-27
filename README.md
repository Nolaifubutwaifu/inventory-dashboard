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
| `INVENTORY_UPDATE_SECRET` | Yes, to accept uploads | Long random string. Send it as `Authorization: Bearer <secret>`. Used by the inventory, sales, and history uploads. |
| `DASHBOARD_PASSWORD` | No | When set, the site asks for this password and stores a signed httpOnly cookie. Leave unset to keep the dashboard open. Upload routes still use the bearer token and are not blocked by the cookie. |
| `SHOW_CUSTOMERS` | No | Set to `true` to show top customer names from history. Hidden unless this is exactly `true` and the file is not redacted. |
| `HISTORY_PREVIEW` | No | Set to `1` locally to show `data/history.sample.json` when Blob has no `history.json`. Leave unset in production. |

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

- `/` — stock matrix, with a Sales tab between Needs attention and Export
- `GET /api/inventory` — current stock JSON
- `POST /api/inventory/update` — replace stock in Blob
- `GET /api/sales` — current `sales.json`, or `{ "sales": null }` when none is stored
- `POST /api/sales/update` — replace `sales.json` in the same private Blob store
- `POST /api/history/update` — replace private `history.json`. There is no public GET for history
- `POST /api/auth/login` — set the dashboard cookie when `DASHBOARD_PASSWORD` is set

`GET /api/inventory` and `GET /api/sales` stay unauthenticated JSON reads, as they are today. This repo does not set `Access-Control-Allow-Origin` on them. History is not given the same read route, because it includes customer names and revenue. The page reads it on the server. When `DASHBOARD_PASSWORD` is set, those GET routes sit behind the same cookie as the page. The upload POSTs do not.

## Sales

`POST /api/sales/update` uses the same bearer token as the inventory upload. The body is stored as `sales.json`:

```json
{
  "updated_at": "2026-10-27T12:45:54",
  "source": "Brisbins_Daily_Sales_History.xlsx",
  "items": [
    {
      "date": "2026-10-20",
      "type": "Bin",
      "size": "240L",
      "colour": "Red",
      "qty": 4,
      "invoices": "00008120, 00008121"
    }
  ],
  "totals": [
    {
      "date": "2026-10-20",
      "invoices": 3,
      "bins": 10,
      "lids": 4,
      "parts": 0,
      "sales_ex_gst": 1234.5,
      "sales_incl_gst": 1357.95,
      "freight_ex_gst": 120,
      "notes": ""
    }
  ]
}
```

`items` is one row per date, type (`Bin`, `Lid`, or `Part`), size, and colour. `invoices` is free text and may be empty. `totals` is one row per weekday, including weekdays with no sales. Weekend days are absent. Only sales are included.

80L and 120L lids are one shared lid. The file may send `80L`, `120L`, or `80L/120L`; the tab treats them as `80/120L` and joins them to the stock matrix lid. Colour matching ignores capitals and extra spaces (`Dark grey` and `Dark Grey` are the same). Parts put the part name in `size` and leave `colour` empty. They are shown by name and are not joined to stock.

Until `sales.json` exists, the Sales tab shows an empty state. Set `SALES_PREVIEW=1` locally to show `data/sales.sample.json` when Blob has no sales file.

The forecast uses the days on file, at most the last 6 months. It does not fill days before the first sale. Trading days are weekdays on the calendar from the first date to the last, so weekends are not counted and a missing weekday inside that span counts as zero. Expected sales next month are that daily average times the weekdays in the next calendar month (Australia/Brisbane).

The container suggestion is forecast demand over lead time plus cover after arrival, minus stock on hand. A negative count is a backorder and adds to the amount. The result is never below 0, and it is rounded up to a whole unit. Defaults are 8 weeks lead time, 8 weeks cover after arrival, and a blank container capacity (not capped). Those three values can be edited on the tab and are remembered in the browser.

```bash
curl -X POST "$APP_URL/api/sales/update" \
  -H "Authorization: Bearer $INVENTORY_UPDATE_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @data/sales.sample.json
```

A successful post returns `{ "ok": true, "pathname": "sales.json", "items", "totals", "updated_at" }`.

## Sales history

`POST /api/history/update` uses the same bearer token. The body is `history.json` from `sync_history.py` (`schema_version` 1). The blob keeps the uploaded JSON. The Sales tab reads it on the server and does not publish a raw history route.

The tab keeps the daily sales file as a fallback. When history is present it shows sales by month with the same month last year, a month-of-year profile, average order value, freight share, credit notes, and invoice counts. Top customers (last 3, 6, 12, or 24 months) render only when `SHOW_CUSTOMERS=true` and `customers_redacted` is false.

Bin and lid quantities come from `units_monthly`. The coverage line uses `coverage.units`, including `final`: the line says `complete` or `in progress`. Months below full item coverage are marked and greyed. `coverage.units.description_amounts_inc_gst` is noted separately. Those amounts are not the sales totals.

Unit forecasts use days from `coverage.units.complete_from_date` (at most the last 6 months) and size mixes from months whose `unit_coverage` is full. Money trends use the full money history in that 6 month window. A low confidence note stays until the unit window covers about 3 months. A seasonal adjustment, from the same month last year against the trailing full months, is shown and off until turned on. Lead time, cover, and container capacity stay editable (8 weeks, 8 weeks, blank).

```bash
curl -X POST "$APP_URL/api/history/update" \
  -H "Authorization: Bearer $INVENTORY_UPDATE_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @data/history.sample.json
```

A successful post returns `{ "ok": true, "pathname": "history.json", "schema_version", "months", "days", "generated_at" }`.

Set `HISTORY_PREVIEW=1` locally to show `data/history.sample.json` when Blob has no history file.

The optional password is a signed httpOnly cookie, checked in `proxy.ts` (the Next.js proxy, the current name for middleware). It stays off unless `DASHBOARD_PASSWORD` is set. `/api/inventory/update`, `/api/sales/update`, and `/api/history/update` keep working with the bearer token.
