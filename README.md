# RestoServe

Restaurant table management with a shared kitchen queue. The original two-floor table layout, nine menu items, prices, ingredients, and allergen information are retained.

- **Pelayan & Meja** (`index.html`): choose a table, draft dishes and special requests, record customer allergies, send new or additional orders, serve individual ready dishes, and clear completed tables.
- **Dapur** (`kitchen.html`): oldest-first tickets, individual preparation stages, grill/fryer/drinks/dessert filters, elapsed time and dish targets, change alerts, cancellation reasons, and prominent allergy notes.
- **Menu & Stok** (`menu.html`): ingredients/allergens and shared sold-out controls. Sold-out dishes cannot be submitted, including when availability changes during checkout.
- **Laporan** (`reports.html`): completed portions, average wait and cooking time, station/dish/day breakdowns, and current overdue dishes. Today follows Asia/Jakarta (WIB). Archived table orders remain in reports.

## Customer visits

Before ordering, open the table and record men aged 12+, women aged 12+, and children under 12. Categories are exclusive; children are not counted again in the adult categories. At least one customer is required. Counts can be corrected while the visit is active. Counts above table capacity show a warning and can still be recorded.

A visit is counted once regardless of additional or cancelled food orders. Clearing the table ends the visit, including a visit with no food orders, and retains the record. Customer reports use the arrival date in Asia/Jakarta; corrections and visits ending after midnight stay on their arrival day. Reports include category totals, visit totals, average group size, a daily chart, and the latest 100 visits. Seven- and thirty-day customer periods cover calendar days in WIB.

Existing active orders can receive manually entered customer counts, using the first recorded order time as their arrival time. Historic customer counts are not guessed or backfilled. Visits and linked orders persist in D1; one active visit per table and request/revision checks prevent duplicate or stale updates.

## Shared state

Orders, dish timestamps, availability, and events live in Cloudflare D1. Clients poll the same service every two seconds; browser storage is used only for device-local acknowledgement preferences. Each submitted order has a stable request ID so retrying a lost response does not create another ticket. Revision checks prevent stale devices from overwriting another device's changes. Clearing a table is blocked until all dishes are served or cancelled.

Audio requires clicking **Aktifkan suara** in each browser tab. Notifications also appear in-page, including while audio is disabled. This is an operational staff interface. The Site starts private; dashboard navigation selects a work view and does not assign staff access roles.

Preparation targets in `data/catalog.js` are initial estimates in minutes: burgers 10–12, fried chicken 15, wrap 10, fries 6, nuggets 8, drinks 2–3, sundae 4. Reports calculate averages per dish line, rather than weighting by portions. A quantity on a dish line progresses together.

## Local development

Requires Node.js 24+ for the SQLite-backed test suite.

```sh
npm ci
npm run db:local
npm run dev
```

Open the local URL printed by Wrangler. Preview data is local and separate from production. Regenerate migrations after schema changes with `npm run db:generate`. Production migrations and their metadata are append-only once applied.

```sh
npm test
npm run build
```

The build preserves the static HTML/JavaScript interface and embeds its assets in a Cloudflare-compatible Worker at `dist/server/index.js`. The artifact also contains `.openai/hosting.json` and generated Drizzle migrations. No database schema is created at request time.

The browser smoke workflow was verified in independent waiter/kitchen browser contexts and at a 390px mobile width. Native browser WebMCP support was unavailable in the test browser; its optional, feature-detected tools have read-only and dish-update interfaces that share the visible application actions.
