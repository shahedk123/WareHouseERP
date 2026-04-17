# WarehouseVoice — Complete Build & Deploy Specification for Claude Code

Read this entire file before writing a single line of code. This is the
single source of truth. Do not ask for clarification — make sensible decisions
for anything not explicitly specified here.

---

## 0. Mission

Build and deploy a warehouse inventory management PWA used in noisy, busy
warehouse floors in India and GCC (Saudi Arabia, UAE, Qatar). Users include:

- **Pickers**: low-literacy floor workers who handle physical goods. They
  cannot type. They photograph bills and speak voice notes.
- **Accountants**: office staff who verify what pickers recorded and match
  items to the ERP product catalog.
- **Managers/Owners**: monitor throughput, queue depth, and stale work.

The product targets small-to-mid warehouses currently using paper-based
systems. The key design principle: every physical product movement triggers
a digital scan event by the picker. The accountant — not the picker — does
all product matching and verification against the ERP.

---

## 1. Repository structure

```
warehousevoice/
├── frontend/          # React + Vite + Tailwind PWA
├── backend/           # Node.js + Express API
├── supabase/
│   └── migrations/    # SQL migration files
├── .env               # Already exists — read all credentials from here
└── CLAUDE.md          # This file
```

---

## 2. Environment variables (read from .env)

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
GROQ_API_KEY
GEMINI_API_KEY
VERCEL_TOKEN
```

Backend also needs: `PORT=3001`, `FRONTEND_URL` (set after Vercel deploy).
Frontend Vite env: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## 3. Tech stack

| Layer | Technology | Hosting |
|---|---|---|
| PWA Frontend | React 18 + Vite + Tailwind CSS | Vercel (free) |
| Backend API | Node.js + Express | Railway (free) |
| Database | PostgreSQL via Supabase | Supabase (free) |
| File Storage | Supabase Storage | Supabase (free, 1GB) |
| OCR | Gemini 1.5 Flash Vision | Google AI Studio (free tier) |
| Speech-to-Text | Groq Whisper-large-v3 | Groq (free, 14400 req/day) |
| NLU extraction | Gemini 1.5 Flash | Google AI Studio (free tier) |

---

## 4. Database schema

### Table: `bills`
```sql
CREATE TABLE bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number   text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_sub  text,
  photo_url     text,
  picker_name   text,
  created_at    timestamptz DEFAULT now()
);
```

### Table: `pending_modifications`
```sql
CREATE TABLE pending_modifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number          text NOT NULL,
  customer_name        text NOT NULL,
  customer_sub         text,
  raw_statement        text NOT NULL,
  action_type          text CHECK (action_type IN ('ADD','REMOVE','REPLACE')),
  product_hint         text,
  quantity             numeric,
  picker_name          text,
  photo_url            text,
  photo_storage_path   text,
  resolved             boolean DEFAULT false,
  matched_product_id   text,
  matched_product_name text,
  matched_product_code text,
  matched_product_unit text,
  resolved_by          text,
  resolved_at          timestamptz,
  created_at           timestamptz DEFAULT now()
);
```

### Table: `product_catalog`
```sql
CREATE TABLE product_catalog (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en   text NOT NULL,
  name_ml   text,
  code      text NOT NULL UNIQUE,
  unit      text NOT NULL,
  category  text,
  alt_names text
);

INSERT INTO product_catalog (name_en, name_ml, code, unit, category) VALUES
  ('OPC Cement 50kg',   'സിമന്റ്',        'CEM-001', 'bag',  'Building'),
  ('Wall Tile 30x60cm', 'ടൈൽ',            'TIL-023', 'box',  'Tiles'),
  ('PVC Pipe 4"',       'PVC പൈപ്പ്',     'PVC-104', 'pcs',  'Plumbing'),
  ('Steel Rod 12mm',    'ഇരുമ്പ് ദണ്ഡ്',  'STL-012', 'kg',   'Steel'),
  ('River Sand',        'മണൽ',            'SND-001', 'load', 'Aggregate'),
  ('Wire Mesh 6x2m',    'വൈർ മെഷ്',      'MSH-002', 'roll', 'Steel'),
  ('Wall Putty 20kg',   'പ്ലാസ്റ്റർ',     'PTY-020', 'bag',  'Finishing'),
  ('Paint Primer 4L',   'പ്രൈമർ',         'PNT-P04', 'tin',  'Paints'),
  ('Hollow Block 8"',   'ഹോളോ ബ്ലോക്ക്',  'BLK-008', 'pcs',  'Building'),
  ('MS Angle 50x50',    'ആംഗിൾ',          'ANG-050', 'kg',   'Steel');
```

### RLS Policies
```sql
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_bills" ON bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_mods" ON pending_modifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_read_catalog" ON product_catalog FOR SELECT USING (true);
```

### Supabase Storage
- Bucket name: `bill-photos`
- Public: false
- Max file size: 5MB
- Allowed MIME types: image/jpeg, image/png, image/webp
- Create via Supabase JS client in a migration script

---

## 5. Backend API — Node.js / Express

### Dependencies
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "multer": "^1.4.5",
  "@supabase/supabase-js": "^2.39.0",
  "groq-sdk": "^0.3.3",
  "@google/generative-ai": "^0.2.1",
  "sharp": "^0.33.2"
}
```

### Server setup (`backend/server.js`)
- `express.json()` body parser
- CORS: allow `process.env.FRONTEND_URL` and `http://localhost:5173`
- Health check: `GET /health` → `{ status: "ok", timestamp: new Date() }`
- Error handler middleware: catch all, return `{ error: message }` with status

### `POST /api/ocr`
**Purpose**: Picker uploads a bill photo. Returns extracted bill info + photo URL.

**Process**:
1. Accept `multipart/form-data`, field name `photo`
2. Compress using sharp: resize to max 800px wide, JPEG quality 75
3. Upload compressed buffer to Supabase Storage:
   - Path: `bills/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
   - Content-type: `image/jpeg`
   - Store the path for later deletion
4. Generate a signed URL (7 day expiry) for the uploaded file
5. Convert compressed buffer to base64
6. Send to Gemini Vision (`gemini-1.5-flash`) with prompt:
   ```
   Extract bill/invoice details from this image.
   Return ONLY valid JSON with no markdown fences:
   {
     "bill_number": "invoice or bill ID as printed, or null",
     "customer_name": "company or customer name, or null",
     "customer_location": "address, city or phone if visible, or null"
   }
   ```
7. Parse response JSON (strip any ```json fences first)
8. Return: `{ bill_number, customer_name, customer_location, photo_url, photo_storage_path }`

**Error handling**: If Gemini returns unparseable JSON, return
`{ bill_number: null, customer_name: null, customer_location: null, photo_url, photo_storage_path }`
so the picker can fill in manually.

---

### `POST /api/transcribe`
**Purpose**: Picker sends a voice recording. Returns transcript + array of extracted operations.

**Process**:
1. Accept `multipart/form-data`, field name `audio`
2. Send audio buffer to Groq Whisper API:
   - Model: `whisper-large-v3`
   - No language lock — auto-detect (supports English, Malayalam, Arabic, Manglish/code-switching)
   - Response format: `json`
3. Pass transcript to Gemini 1.5 Flash with this exact prompt:
   ```
   You are a warehouse inventory assistant. Extract ALL product operations
   from this spoken statement. A single statement can contain multiple operations.

   Statement: "${transcript}"

   Return ONLY a valid JSON array with no markdown fences:
   [
     {
       "action_type": "ADD" or "REMOVE" or "REPLACE",
       "product_hint": "product description as spoken, cleaned up",
       "quantity": number or null
     }
   ]

   Rules:
   - ADD = adding/increasing items on the bill
   - REMOVE = removing/decreasing items from the bill
   - REPLACE = swapping one item for another
   - Extract EVERY distinct product mentioned
   - If quantity is unclear, use null
   - Keep product_hint natural — as the person described it
   - Always return an array, even for single items
   ```
4. Parse response as JSON array
5. Fallback: if JSON parse fails, retry once. If still fails, return:
   `[{ action_type: "ADD", product_hint: transcript, quantity: null }]`
6. Return: `{ transcript: string, operations: [{ action_type, product_hint, quantity }] }`

---

### `POST /api/modifications`
**Purpose**: Picker submits their full session — all recordings for one bill.

**Body**:
```json
{
  "bill_number": "BILL-2024-0847",
  "customer_name": "Al-Rashid Building Supplies",
  "customer_sub": "Jeddah Industrial Zone · 0501234567",
  "photo_url": "https://...",
  "photo_storage_path": "bills/1234-abcd.jpg",
  "picker_name": "Raju K.",
  "operations": [
    {
      "raw_statement": "add 5 bags cement and remove 3 tiles",
      "action_type": "ADD",
      "product_hint": "OPC cement bags",
      "quantity": 5
    }
  ]
}
```

**Process**:
1. Upsert into `bills` table (ON CONFLICT bill_number DO UPDATE)
2. Insert each operation into `pending_modifications`
3. Return: `{ success: true, inserted: operations.length }`

---

### `GET /api/modifications?status=pending`
**Purpose**: Accountant fetches all unresolved modifications grouped by bill.

**Returns**:
```json
{
  "bills": [
    {
      "bill_number": "BILL-2024-0847",
      "customer_name": "Al-Rashid Building Supplies",
      "customer_sub": "Jeddah Industrial Zone",
      "photo_url": "https://...",
      "modifications": [
        {
          "id": "uuid",
          "action_type": "ADD",
          "product_hint": "OPC cement bags",
          "quantity": 5,
          "picker_name": "Raju K.",
          "created_at": "2024-01-01T09:41:00Z",
          "resolved": false
        }
      ]
    }
  ]
}
```

- Only unresolved mods (`resolved = false`)
- Grouped by bill_number in application code
- Within each bill: oldest mods first
- Bills ordered by oldest modification first

---

### `GET /api/modifications/resolved`
- Resolved mods from last 24 hours
- Include: resolved_at, matched_product_name, matched_product_code, customer_name, bill_number
- Order: newest resolved_at first

---

### `PATCH /api/modifications/:id/resolve`
**Body**: `{ product_name, product_code, product_unit, resolved_by }`

**Process**:
1. Update row: `resolved=true`, `resolved_at=now()`, set matched_* fields
2. Fetch `photo_storage_path` from the row
3. Delete photo from Supabase Storage:
   ```js
   await supabase.storage.from('bill-photos').remove([photo_storage_path])
   ```
4. Return: `{ success: true }`

**Important**: Only delete the photo after ALL modifications for that bill are resolved.
Check: `SELECT COUNT(*) FROM pending_modifications WHERE bill_number=$1 AND resolved=false`
If count > 0, skip deletion. If count = 0, delete.

---

### `GET /api/catalog?q=searchterm`
- Search: `name_en ILIKE '%q%' OR name_ml ILIKE '%q%' OR code ILIKE '%q%' OR category ILIKE '%q%' OR alt_names ILIKE '%q%'`
- Max 8 results
- No query → first 10 rows
- Returns: `[{ id, name_en, name_ml, code, unit, category }]`

---

### `POST /api/catalog/upload`
- Accept CSV file upload
- Parse CSV with columns: Name_EN, Name_ML, Code, Unit, Category, Alt_Names
- Upsert into product_catalog (ON CONFLICT code DO UPDATE)
- Return: `{ inserted: n, updated: n, errors: [] }`

---

### `GET /api/metrics`
**Returns**:
```json
{
  "bills_today": 14,
  "resolved_today": 9,
  "pending_total": 17,
  "stale_count": 2,
  "avg_resolve_minutes": 11,
  "stale_bills": [
    {
      "bill_number": "BILL-2024-0847",
      "customer_name": "Al-Rashid Building Supplies",
      "customer_sub": "Jeddah Industrial Zone",
      "mod_count": 3,
      "oldest_ts": "2024-01-01T09:41:00Z",
      "age_minutes": 137
    }
  ],
  "picker_activity": [
    { "picker_name": "Raju K.", "mod_count": 12 }
  ],
  "throughput_by_hour": [
    { "hour": "08", "resolved": 3 },
    { "hour": "09", "resolved": 6 }
  ]
}
```

- Stale = unresolved mods created more than 2 hours ago
- Bills today = created since midnight (use `DATE(created_at) = CURRENT_DATE`)
- Throughput: resolved mods grouped by hour for today
- Use SQL aggregations, not app-level loops

---

## 6. Frontend PWA — Complete UI/UX Specification

### 6.1 Global design principles

**Theme: Light, clean, professional**
All surfaces are white or light gray. No dark mode. The app must look like a
professional enterprise tool, not a consumer app.

**Warehouse environment constraints**:
- All interactive tap targets minimum 56px tall, preferably 64–72px
- High contrast — everything must be readable in bright warehouse lighting
- Large bold labels — pickers may be reading at arm's length
- Color-coded operations consistently throughout: green=ADD, red=REMOVE, purple=REPLACE
- Big icons with both icon AND text label — never icon-only for actions
- Buttons must have strong visual weight — filled backgrounds, not just borders

**CSS Custom Properties** (define in `:root`):
```css
--bg: #EEF1F8;
--card: #FFFFFF;
--card2: #F4F6FB;
--card3: #E8EBF4;
--bd: rgba(30,50,120,0.10);
--bd2: rgba(30,50,120,0.18);
--bl: #2563EB;    /* primary blue */
--bl2: #EFF4FF;   /* blue tint bg */
--bl3: #DBEAFE;   /* blue tint border */
--gr: #16A34A;    /* success / ADD */
--gr2: #F0FDF4;
--gr3: #DCFCE7;
--am: #D97706;    /* warning / stale */
--am2: #FFFBEB;
--am3: #FEF3C7;
--rd: #DC2626;    /* danger / REMOVE */
--rd2: #FEF2F2;
--rd3: #FEE2E2;
--pu: #7C3AED;    /* REPLACE */
--pu2: #F5F3FF;
--pu3: #EDE9FE;
--cy: #0891B2;    /* photo/info */
--cy2: #ECFEFF;
--cy3: #CFFAFE;
--t1: #0F172A;    /* primary text */
--t2: #475569;    /* secondary text */
--t3: #94A3B8;    /* muted/placeholder */
--t4: #CBD5E1;    /* borders, dividers */
--t5: #E2E8F0;    /* subtle borders */
--sh: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
--sh2: 0 4px 16px rgba(0,0,0,0.10);
```

**Typography**: Use `font-family: 'Inter', system-ui, sans-serif`
Load from Google Fonts. Also load `Noto Sans Malayalam` and `Noto Sans Arabic`
for ML/AR language support. Apply `font-family: 'JetBrains Mono', monospace`
for bill IDs, codes, quantities.

---

### 6.2 Top navigation bar

- **Background**: `#2563EB` (solid blue) — this is intentional so tabs are always
  visible against it (previous versions had same-color tabs that were invisible)
- **Height**: 54px
- **Left**: Logo dot (26×26px, rounded, white at 22% opacity) + "WarehouseVoice" text
  in white bold + current mode label in muted white
- **Center**: Mode tab strip
  - Container: `background: rgba(255,255,255,0.15); border-radius: 10px; padding: 3px`
  - Each tab: `padding: 7px 16px; min-height: 34px; font-weight: 700; font-size: 11px`
  - Inactive: `color: rgba(255,255,255,0.75); background: transparent`
  - Hover: `color: white; background: rgba(255,255,255,0.15)`
  - **Active**: `background: white; color: #2563EB; box-shadow: var(--sh)` — white pill on blue
  - Tab labels + small SVG icon each: Picker (camera icon), Accountant/Verify (lines icon), Manager (bar chart icon)
  - Accountant tab has amber badge showing pending count
- **Right**: Language dropdown
  - `<select>` element styled with white text on translucent background
  - Options: "English", "മലയാളം", "العربية"
  - Padding: `7px 26px 7px 10px` (space for arrow)
  - Custom arrow overlay (white chevron)

---

### 6.3 Language system

Implement a `useLanguage()` hook. Store selected language in `localStorage`.
Apply `dir="rtl"` and `font-family: 'Noto Sans Arabic'` to the picker panel
when Arabic is selected. Apply `font-family: 'Noto Sans Malayalam'` for ML.

**Translation keys required** (provide all three languages):
```js
{
  // Step 1
  scanBill: { en: "Scan the Bill", ml: "ബിൽ സ്കാൻ ചെയ്യുക", ar: "صوّر الفاتورة" },
  scanSub: {
    en: "Take a photo of the physical bill. The Bill ID and customer name will be read automatically.",
    ml: "ബില്ലിന്റെ ഫോട്ടോ എടുക്കുക. ബിൽ ID ഞങ്ങൾ വായിക്കും.",
    ar: "التقط صورة للفاتورة. سنقرأ رقمها واسم العميل تلقائياً."
  },
  noTypingNeeded: { en: "No typing needed", ml: "ടൈപ്പ് ചെയ്യേണ്ട", ar: "لا حاجة للكتابة" },
  readingBill: { en: "Reading bill...", ml: "ബിൽ വായിക്കുന്നു...", ar: "جارٍ قراءة الفاتورة..." },
  confirmStart: { en: "Confirm & Start Recording", ml: "സ്ഥിരീകരിക്കുക", ar: "تأكيد وابدأ التسجيل" },
  retake: { en: "Retake", ml: "വീണ്ടും എടുക്കുക", ar: "إعادة التصوير" },
  billId: { en: "Bill ID", ml: "ബിൽ ID", ar: "رقم الفاتورة" },
  customer: { en: "Customer / Company", ml: "കസ്റ്റമർ / കമ്പനി", ar: "العميل / الشركة" },
  locationPhone: { en: "Location · Phone (optional)", ml: "സ്ഥലം · ഫോൺ", ar: "الموقع · الهاتف" },
  newBill: { en: "New Bill", ml: "പുതിയ ബിൽ", ar: "فاتورة جديدة" },
  // Step 2
  recordHint: {
    en: "Say what changed — you can list multiple items in one recording",
    ml: "എന്ത് മാറ്റമുണ്ടായോ അത് പറയൂ — ഒരു റെക്കോർഡിങ്ങിൽ ഒന്നിൽ കൂടുതൽ ഇനങ്ങൾ പറയാം",
    ar: "قل ما تغيّر — يمكنك ذكر عدة أصناف في تسجيل واحد"
  },
  tapRecord: { en: "Tap to Record", ml: "ടാപ്പ് ചെയ്ത് റെക്കോർഡ്", ar: "اضغط للتسجيل" },
  recording: { en: "Recording... tap to stop", ml: "റെക്കോർഡ് ചെയ്യുന്നു...", ar: "جارٍ التسجيل..." },
  processing: { en: "Processing...", ml: "പ്രോസസ്സ്...", ar: "معالجة..." },
  added: { en: "items added", ml: "ഇനങ്ങൾ ചേർത്തു", ar: "أُضيفت" },
  clearRecording: { en: "Clear", ml: "മായ്ക്കുക", ar: "مسح" },
  queue: { en: "Queue", ml: "ക്യൂ", ar: "قائمة الانتظار" },
  clearAll: { en: "Clear All", ml: "എല്ലാം മായ്ക്കുക", ar: "مسح الكل" },
  deleteItem: { en: "Del", ml: "ഡിൽ", ar: "حذف" },
  noItemsYet: { en: "No items yet — record above", ml: "ഒന്നും ഇല്ല", ar: "لا توجد عناصر" },
  // Step 3
  sendAll: { en: "Send All to Accountant", ml: "അക്കൗണ്ടന്റിനു അയക്കുക", ar: "إرسال الكل للمحاسب" },
  sent: { en: "Sent!", ml: "അയച്ചു!", ar: "تم الإرسال!" },
  // Modal
  newBillTitle: { en: "Start New Bill", ml: "പുതിയ ബിൽ ആരംഭിക്കുക", ar: "بدء فاتورة جديدة" },
  newBillSub: { en: "Resets the current session.", ml: "നിലവിലെ സെഷൻ റീസെറ്റ് ചെയ്യും.", ar: "سيتم إعادة تعيين الجلسة الحالية." },
  cancel: { en: "Cancel", ml: "റദ്ദാക്കുക", ar: "إلغاء" },
  startBill: { en: "Start Bill", ml: "ആരംഭിക്കുക", ar: "بدء" },
}
```

---

### 6.4 Picker PWA — full page spec

#### Step indicator (3 steps: Scan Bill → Record → Send)

At top of picker content area. Three numbered circles connected by lines.

```
[1] ——— [2] ——— [3]
Scan    Record   Send
```

- Inactive step: gray circle outline, gray text
- Active step: blue filled circle, blue text, **blue glow ring** (`box-shadow: 0 0 0 3px #DBEAFE`)
- Done step: green filled circle, white checkmark ✓, green text
- Connecting lines: gray normally, green when step before it is done
- Transition: smooth 0.25s on all properties

#### Step 1 — Scan Bill

**Before photo is taken:**

Large card component:
- White background, `border-radius: 20px`
- Border: `2px dashed rgba(30,50,120,0.18)` (dashed to signal "action needed")
- Padding: `28px 20px`
- Centered content, `cursor: pointer`
- Hover: blue tinted background + solid blue border
- Active (press): `transform: scale(0.98)`
- **Camera icon**: 72×72px rounded square (`border-radius: 20px`), blue tint background
  - SVG camera icon, blue strokes
- **Title**: 20px, weight 800, letter-spacing -0.03em → translated `scanBill`
- **Subtitle**: 13px, `color: var(--t2)`, line-height 1.6 → translated `scanSub`
- **Blue pill**: `background: var(--bl3); color: var(--bl); padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 600` → "No typing needed"
- On tap: `<input type="file" accept="image/*" capture="environment">` (hidden, triggered programmatically)
  - `capture="environment"` opens rear camera directly on mobile

**Photo loading state** (after selection, before OCR returns):
- Card becomes a loading state showing the photo thumbnail
- Overlay spinner with text "Uploading & reading bill..."
- Do NOT show the editable fields yet

**After OCR returns — photo + editable fields:**

Replace the scan card with:
1. Photo preview (`max-height: 200px`, `object-fit: contain`, white background)
   - "Retake" button (top-right, white with red text): `onClick → reset to scan state`
2. Below photo, a bordered block with:
   - Status row: "Fields extracted — please verify" (green checkmark icon + text)
     OR "Could not read bill — please fill in" (amber warning icon) if OCR returned nulls
   - Three labeled inputs (pre-filled if OCR succeeded, empty if not):
     - **Bill ID** (label + input, monospace font on value)
     - **Customer / Company** (label + input)
     - **Location · Phone (optional)** (label + input)
   - Input style: `background: var(--card2); border: 1.5px solid var(--bd2); border-radius: 10px; padding: 11px 13px; font-size: 14px; font-weight: 600`
   - On focus: border changes to `var(--bl)`
3. **Confirm button**: `width: 100%; padding: 16px; border-radius: 14px; background: var(--bl); color: white; font-weight: 800; font-size: 15px; min-height: 56px; box-shadow: var(--sh2)`
   - Text: "Confirm & Start Recording"
   - Disabled if bill ID or customer name is empty

**After confirm:**
- Step 1 collapses/hides
- Bill bar appears (sticky at top of step 2 area):
  - Blue tinted card (`background: var(--bl2); border: 1.5px solid var(--bl3); border-radius: 16px; padding: 12px 16px`)
  - Left: Bill ID (monospace, small, blue) + Customer Name (large bold) + Location (small muted)
  - Right: "New Bill" button (red tinted, smaller, `border-radius: 12px`)
    - On click: open New Bill modal
    - Modal resets everything and returns to step 1

#### Step 2 — Record

**Hint text card** (blue left border, blue tinted background):
```
Say what changed — you can list multiple items in one recording,
e.g. "Add 5 bags cement, remove 3 tiles, replace the steel rod"
```
- `background: var(--bl2); border-left: 3px solid var(--bl); border-radius: 10px; padding: 10px 13px; font-size: 12px`

**Live transcript box** (hidden until recording starts):
- `background: var(--card2); border: 1.5px solid var(--bd2); border-radius: 12px; padding: 12px 14px; min-height: 56px`
- Shows in sequence:
  1. "Listening..." (while recording)
  2. Transcript text (after recording stops + Groq returns)
  3. "Gemini extracting X items..." (while NLU runs)
- **Clear button** (top-right of transcript box, absolute positioned):
  - `background: var(--rd2); border: 1px solid var(--rd3); border-radius: 7px; padding: 5px 10px; color: var(--rd); font-size: 11px; font-weight: 700`
  - Aborts the current recording/processing attempt entirely (does NOT add to queue)

**Record button** (full width, minimum 68px height):
```
Idle:       background: var(--bl);  color: white;  text: "Tap to Record"
Recording:  background: var(--rd);  color: white;  text: "Recording... tap to stop"
            + CSS pulse animation on the dot icon (opacity 1→0.72→1 at 1.2s)
            + dot icon blinks (opacity 1→0→1 at 0.7s)
Processing: background: var(--am2); border: 2px solid var(--am3); color: var(--am)
            text: "Processing..."
Done:       background: var(--gr2); border: 2px solid var(--gr3); color: var(--gr)
            text: "X items added" (where X = number of operations extracted)
            Auto-returns to idle after 1.2s
```

Button layout: flex row, centered, gap 12px. Left element = animated dot circle (`width: 14px; height: 14px; border-radius: 50%; background: currentColor`). Right = text label.

**Queue section** (appears below record button):

Header row:
- Left: "Queue" (section label, 10px uppercase) + item count below it (12px monospace blue)
- Right: "Clear All" button — only shown when 2+ items in queue
  - `background: var(--rd2); border: 1px solid var(--rd3); color: var(--rd); font-size: 10px; font-weight: 700; border-radius: 6px; padding: 4px 10px`

Each queue item card:
- `background: white; border: 1px solid var(--bd); border-radius: 14px; overflow: hidden; box-shadow: var(--sh); min-height: 60px; display: flex`
- **Left colored bar**: `width: 5px; background: [green|red|purple based on action_type]` — flush to card edge
- **Body** (`flex: 1; padding: 10px 12px`):
  - Main text: `product_hint` — 13px, weight 600, color `var(--t1)`
  - Meta row below: action badge + quantity badge + timestamp
    - ADD badge: `background: var(--gr3); color: var(--gr); font-size: 10px; font-family: monospace; padding: 2px 7px; border-radius: 4px; font-weight: 600`
    - REMOVE badge: same pattern with rd3/rd colors
    - REPLACE badge: same pattern with pu3/pu colors
    - Quantity badge: `background: var(--card3); color: var(--t2)`
    - Time badge: `background: var(--card3); color: var(--t3)`
- **Delete strip** (right side):
  - `width: 52px; background: var(--rd2); border-left: 1px solid var(--rd3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer`
  - Hover: `background: var(--rd3)`
  - X icon SVG (18×18px, red strokes) + "Del" label (9px, red, bold)
  - On click: fade out item (opacity 0, translateX 16px, 200ms) then remove from array

Empty queue state:
- `text-align: center; padding: 20px; font-size: 12px; color: var(--t3); border: 1.5px dashed var(--bd2); border-radius: 14px; background: var(--card)`
- Text: translated `noItemsYet`

**After each recording:**
- Gemini returns an array → each item becomes its own card
- One recording saying "add 5 cement and remove 3 tiles" → 2 separate cards
- Cards animate in with: `opacity 0 → 1, translateY -5px → 0, duration 220ms ease`

#### Step 3 — Send button

```
width: 100%; padding: 20px; border-radius: 18px;
background: var(--gr); color: white;
font-weight: 800; font-size: 16px;
min-height: 66px; box-shadow: var(--sh2);
display: flex; align-items: center; justify-content: center; gap: 10px;
```

- Disabled when queue is empty: `opacity: 0.30; cursor: not-allowed; box-shadow: none`
- Hover when enabled: `opacity: 0.87`
- Active: `transform: scale(0.97)`
- Left icon: send arrow SVG (white)
- Text: "Send All to Accountant"

**On click**:
1. POST to `/api/modifications` with full payload (all queue items + bill info + photo_url)
2. On success: button text changes to "✓ Sent!" for 1.5s, queue clears
3. Step indicator advances to step 3 (done state)
4. After 1.5s: button resets, disabled (queue is empty)

#### New Bill modal

Semi-transparent overlay `background: rgba(15,23,42,0.50)`:
- White card: `background: white; border-radius: 20px; padding: 24px; width: 320px; box-shadow: var(--sh2)`
- Title: "Start New Bill" (17px, weight 800)
- Subtitle: "Resets the current session." (12px, `var(--t2)`)
- Three inputs: Bill ID, Customer Name, Location/Phone — same style as OCR inputs
- Cancel button (gray) + Start Bill button (blue)
- On Start Bill: validate bill ID + customer name not empty, then:
  - Reset queue to empty
  - Reset photo/scan state to step 1
  - Update bill bar with new values
  - Close modal

---

### 6.5 Accountant Dashboard — full page spec

#### Layout
- Left sidebar: `width: 290px; flex-shrink: 0; border-right: 1px solid var(--bd); background: white; display: flex; flex-direction: column; overflow: hidden`
- Right panel: `flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: var(--bg)`

#### Sidebar header
- "Bills" label: `font-size: 10px; color: var(--t3); text-transform: uppercase; letter-spacing: 0.09em; font-weight: 700`
- Right: green "Live" indicator — green dot (6px, pulsing animation) + "Live" text
  - Dot animation: `opacity 1 → 0.25 → 1, 2s infinite`

#### Sidebar tabs
- Pending tab + Resolved tab
- Pending has amber badge showing count
- Active tab: `background: var(--bl2); color: var(--bl)`
- Inactive: `color: var(--t3)`, hover `color: var(--t2); background: var(--card2)`

#### Stale alert bar (amber, shown at top of pending list)
Shown when any unresolved mod is older than 2 hours:
- `padding: 9px 12px; background: var(--am2); border: 1px solid var(--am3); border-radius: 8px; font-size: 11px; color: var(--am); font-weight: 700; margin-bottom: 8px`
- "⚠ X modifications untouched >2h"

#### Bill groups

Each bill is a collapsible group card:
```
border-radius: 12px;
border: 1px solid var(--bd);
overflow: hidden;
margin-bottom: 8px;
background: white;
box-shadow: var(--sh);
```

State-based border colors:
- Default: `var(--bd)`
- Has selected mod inside: `var(--bl)` + `box-shadow: 0 0 0 2px var(--bl3)`
- All mods done: `var(--gr)`
- Has stale mod (>2h): `var(--am)`

**Bill group header** (clickable to expand/collapse):
- `display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; background: white`
- Hover: `background: var(--card2)`
- Elements left to right:
  1. Chevron SVG (9px, `color: var(--t4)`, rotates 90° when open, `transition: transform 0.2s`)
  2. Bill ID column (`flex: 1; min-width: 0; overflow: hidden`):
     - Bill number: `font-family: monospace; font-size: 11px; font-weight: 600; color: var(--bl)`
     - Customer name: `font-size: 12px; font-weight: 700; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
     - Customer sub: `font-size: 10px; color: var(--t2)`
  3. **"Copy" button**: `background: var(--bl2); border: 1px solid var(--bl3); border-radius: 5px; padding: 3px 7px; font-size: 9px; font-family: monospace; color: var(--bl); cursor: pointer; white-space: nowrap`
     - On click (stop propagation): copy bill number to clipboard
     - Flash to green "✓" for 1.8s then revert
  4. Status pill:
     - Pending: `background: var(--am3); color: var(--am)` → "X left"
     - Done: `background: var(--gr3); color: var(--gr)` → "done"

**Bill group expanded body:**

Row 1 — Picker names row:
- `padding: 4px 12px 6px; font-size: 10px; color: var(--t3); background: var(--card2); border-top: 1px solid var(--bd)`
- Left: comma-joined picker names. Right: "X mods"

Row 2 — Photo row:
```
padding: 8px 12px;
border-top: 1px solid var(--bd);
display: flex; align-items: center; gap: 8px;
cursor: pointer (if photo exists);
transition: background 0.13s;
```
- If photo exists:
  - Thumbnail: `width: 44px; height: 34px; border-radius: 6px; object-fit: cover; border: 1px solid var(--bd2)`
  - Label: "📷 Bill photo" in cyan color (`var(--cy)`, 11px, bold)
  - Sub: "tap to view full" (10px, muted)
  - Right: "auto-purge" green tag
  - On click: open photo in detail panel
- If no photo:
  - Gray placeholder icon (camera outline)
  - "No photo" (muted cyan, 11px)
  - "picker skipped" (10px, muted)
  - Not clickable

Modification rows (one per mod):
```
display: flex; align-items: center; gap: 8px;
padding: 8px 12px;
border-top: 1px solid var(--bd);
cursor: pointer;
transition: background 0.12s;
```
- Hover: `background: var(--card2)`
- Selected: `background: var(--bl2)`
- Resolved: `opacity: 0.40`
- Elements:
  1. Colored action bar: `width: 3px; height: 28px; border-radius: 2px; background: [green|red|purple]`
  2. Main content (`flex: 1; min-width: 0`):
     - Hint: `font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--t1)`
     - Sub: `font-size: 10px; color: var(--t3); font-family: monospace; margin-top: 1px` → "ADD · 09:41 · Raju K."
  3. Quantity: `font-size: 11px; font-weight: 700; font-family: monospace; color: var(--bl)` → "×5"
  4. Checkmark (if resolved): ✓ in green

Progress row (bottom of expanded bill):
- `padding: 7px 12px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--bd); background: var(--card2)`
- "X/Y verified" (10px, muted)
- Thin progress bar: `width: 64px; height: 3px; background: var(--t4); border-radius: 2px; overflow: hidden`
  - Fill: `background: var(--gr)` at `width: N%`

#### Resolved tab content

Each resolved item:
- White card with subtle border
- Bill number (monospace, blue) + time-ago badge (green if <2h, amber if >2h)
- Customer name (bold)
- Hint text (muted)
- Matched product code + name in green
- "Photo auto-purged" note in cyan if photo existed

Items ordered newest-first. Auto-cleared after 24h (by backend, not frontend).

---

### 6.6 Accountant Detail Panel — full spec

#### Empty state (nothing selected)
- Centered vertically and horizontally
- Large left-arrow icon (`font-size: 28px; color: var(--t4)`)
- "Select a modification to verify" (12px, muted)

#### When a modification is selected

**Banner** (white card, `box-shadow: var(--sh)`, blue accent):
```
display: flex; align-items: flex-start; gap: 10px;
padding: 14px 18px;
background: white;
border-bottom: 1px solid var(--bd);
flex-wrap: wrap;
```
- Left column (`flex: 1`):
  - "BILL NUMBER" label (10px, uppercase, muted, `letter-spacing: 0.08em`)
  - Bill number (monospace, 14px, weight 600, blue)
  - Customer name (16px, weight 800, `--t1`)
  - Customer sub (11px, muted)
- Right buttons:
  - **"Copy Bill ID"** button (blue tinted):
    - `background: var(--bl2); border: 1px solid var(--bl3); border-radius: 8px; padding: 7px 13px; font-size: 11px; font-family: monospace; font-weight: 600; color: var(--bl)`
    - On click: copy to clipboard → flash to "✓ Copied!" green for 1.8s
  - **NO "Open in ERP" button** — this was explicitly removed

**Bill photo card** (below banner, `margin: 14px 18px 0`):
```
background: white;
border-radius: 14px;
border: 1px solid var(--bd);
overflow: hidden;
box-shadow: var(--sh);
```
- Header: cyan tinted (`background: var(--cy2); border-bottom: 1px solid var(--bd)`)
  - Left: camera icon SVG + "Bill photo — OCR source" (11px, cyan, bold)
  - Right: "auto-purge on resolve" (10px, muted monospace)
- Photo display:
  - If photo: `<img>` full width, `max-height: 200px; object-fit: contain; background: var(--card2); cursor: zoom-in`
  - Below photo: OCR extracted values row (blue tinted `background: var(--bl2); border-top: 1px solid var(--bl3); padding: 10px 14px; display: flex; gap: 16px`):
    - "OCR extracted" mini-label + bill number value
    - "Customer (OCR)" mini-label + customer name value
  - If no photo: centered placeholder `padding: 24px; color: var(--t3); font-size: 12px` + camera outline SVG

**Bill progress section** (inside body, `padding: 14px 18px`):
- Section label: "X of Y verified" (10px uppercase muted)
- Full-width thin progress bar: 3px tall, green fill
- Mini clickable list of all mods for this bill:
  - Each: flex row with colored 3px bar + hint text + quantity + check circle or checkbox
  - Selected mod highlighted with `background: var(--bl2); border: 1px solid var(--bl3); border-radius: 7px`
  - Resolved mods: `opacity: 0.38`

**Picker hint card**:
- `background: white; border: 1px solid var(--bd); border-radius: 10px; padding: 11px 13px; box-shadow: var(--sh)`
- Hint text large: `font-size: 17px; font-weight: 800; color: var(--am); letter-spacing: -0.02em; line-height: 1.3`
  - Wrapped in quotes: `"add 5 bags cement"`
- Chips row (flex, gap 5px, flex-wrap):
  - Action chip: green/red/purple based on action_type
  - Quantity chip: `background: var(--bl3); color: var(--bl)`
  - Picker chip: `background: var(--card3); color: var(--t2)`
  - Time chip: `background: var(--card3); color: var(--t3)`

**Product catalog search**:
- Section label: "Match to product catalog"
- Input: `background: white; border: 1px solid var(--bd2); border-radius: 8px; padding: 9px 11px; font-size: 12px; box-shadow: var(--sh); width: 100%; outline: none`
  - Focus: `border-color: var(--bl)`
  - Placeholder: "Search name, code, category..."
- Results list (appears below input):
  - Each result card: `background: white; border: 1px solid var(--bd); border-radius: 8px; padding: 8px 11px; cursor: pointer; box-shadow: var(--sh)`
  - Hover: `background: var(--bl2); border-color: var(--bl3)`
  - Selected: `background: var(--gr2); border-color: var(--gr3)` (stays green after click)
  - Left: product name (12px, bold) + Malayalam name below (10px, muted)
  - Right: code (10px, monospace, muted) + unit/category (10px, monospace, muted)

**Action buttons row**:
- **Confirm button** (`flex: 1`):
  - `background: var(--gr); color: white; font-weight: 800; font-size: 13px; border-radius: 10px; padding: 13px; box-shadow: var(--sh); border: none`
  - Disabled (no product selected): `opacity: 0.26; cursor: not-allowed; box-shadow: none`
  - Text when disabled: "Select a product first"
  - Text when enabled: "✓ Confirm: [Product Name] × [qty] [unit]"
  - On click: PATCH to resolve endpoint → auto-advance to next unresolved mod
- **Skip button**:
  - `background: white; border: 1px solid var(--bd2); color: var(--t2); font-size: 11px; border-radius: 10px; padding: 13px 14px; box-shadow: var(--sh)`
  - Skips to next unresolved mod without resolving current

**Auto-advance logic on Confirm:**
1. Resolve current mod via API
2. Find next unresolved mod in same bill → select it
3. If bill is fully resolved → find first unresolved mod in next bill
4. If no more mods → show empty state "All caught up!"

---

### 6.7 Manager Dashboard — full page spec

Full-width scrollable area. `padding: 16px; background: var(--bg); display: flex; flex-direction: column; gap: 14px`

#### Top metrics row (4 cards, `display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px`)

Each card: `background: white; border-radius: 14px; border: 1px solid var(--bd); padding: 14px 16px; box-shadow: var(--sh)`

1. **Bills Today** — number in blue (`--bl`), 28px weight 800, "↑ 3 vs yesterday" trend below
2. **Resolved** — number in green, clearance rate % below in muted
3. **Pending Mods** — number in amber, "↓ X stale >2h" in red below
4. **Avg Resolve Time** — number in purple (22px), "improving" or "worsening" trend

#### Two-column layout below metrics
`display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px`

**Left column:**

Card 1 — "⚠ Needs intervention":
- Only shown when stale_count > 0
- Each stale bill as a row:
  - Avatar: 32×32px circle, 2-letter initials, amber background
  - Bill info: bill number + customer name (bold, truncated) + "X mods · Picker · submitted TIME"
  - Age badge: red text, monospace (e.g. "2h 17m")
  - **"Ping Accountant"** button: `background: var(--bl2); border: 1px solid var(--bl3); border-radius: 7px; padding: 5px 10px; font-size: 10px; font-weight: 700; color: var(--bl); cursor: pointer`
    - On click: button text changes to "Pinged!" (UI only in MVP — future: push notification)

Card 2 — "Throughput — resolved / hour":
- Horizontal bar chart for last 8 hours
- Each row: hour label (10px mono) + bar (flex:1, 8px tall, `border-radius: 4px`) + count (10px mono)
- Bar colors:
  - High throughput: `var(--bl)` (blue)
  - Dropping: `var(--am)` (amber)
  - Very low (≤2): `var(--rd)` (red)
- Bar widths proportional to max value in dataset

**Right column:**

Card 3 — "Accountant queue depth":
- One row per accountant: name + "cleared X today" + queue depth badge
- Depth badges:
  - `≤5`: `background: var(--gr3); color: var(--gr)` (green)
  - `6–10`: `background: var(--am3); color: var(--am)` (amber)
  - `>10`: `background: var(--rd3); color: var(--rd)` (red) + ⚠ prefix

Card 4 — "Picker activity today":
- One row per picker: avatar + name + mod count + proportional bar
- Avatar: 28×28px circle, 2-letter initials, different color per picker (rotate through bl/gr/pu)
- Bar: `width: 60px; height: 4px; background: var(--t4); border-radius: 2px; overflow: hidden`
  - Fill: `background: var(--bl)` at proportional width

Card 5 — "System alerts":
- Overloaded accountant alert (red background card): when any accountant queue >10
- Low photo rate alert (amber): when <50% of today's bills have photos
- Each alert card: icon + title (colored bold) + detail (muted)

---

## 7. PWA Configuration

### `vite.config.js` — VitePWA plugin
```js
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'WarehouseVoice',
    short_name: 'WVoice',
    description: 'Voice-first warehouse inventory management',
    theme_color: '#2563EB',
    background_color: '#EEF1F8',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
  }
})
```

Generate simple blue square icons programmatically (use sharp or canvas in a build script).

### Audio recording
```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, {
  mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/mp4'
});
const chunks = [];
recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  const res = await axios.post('/api/transcribe', formData);
  // res.data = { transcript, operations: [{action_type, product_hint, quantity}] }
};
recorder.start();
```

### Client-side image compression
```js
async function compressImage(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
```

---

## 8. Real-time updates (polling)

The accountant dashboard polls `GET /api/modifications?status=pending` every 5 seconds.
Use `setInterval` in a `useModifications()` hook.

```js
useEffect(() => {
  fetchMods();
  const id = setInterval(fetchMods, 5000);
  const handleVisibility = () => { if (!document.hidden) fetchMods(); };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, []);
```

---

## 9. Deployment

### Step 1 — Supabase migrations
```bash
cd supabase
npx supabase db push --db-url "$SUPABASE_URL"
```

Also run a Node.js setup script (`backend/scripts/setup-storage.js`) that:
1. Creates the `bill-photos` bucket if it doesn't exist
2. Sets bucket to private
3. Runs: `node backend/scripts/setup-storage.js`

### Step 2 — Deploy backend to Railway
```bash
npm install -g @railway/cli
cd backend
railway login
railway init --name warehousevoice-backend
railway up
BACKEND_URL=$(railway domain)
```

Set all env vars on Railway:
```bash
railway variables set SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_KEY="$SUPABASE_SERVICE_KEY"
railway variables set GROQ_API_KEY="$GROQ_API_KEY"
railway variables set GEMINI_API_KEY="$GEMINI_API_KEY"
railway variables set FRONTEND_URL="https://warehousevoice.vercel.app"
```

### Step 3 — Deploy frontend to Vercel
```bash
cd frontend
echo "VITE_API_URL=$BACKEND_URL" >> .env.production
echo "VITE_SUPABASE_URL=$SUPABASE_URL" >> .env.production
echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env.production
npx vercel --token "$VERCEL_TOKEN" --prod --yes
```

### Step 4 — Update Railway CORS and redeploy
```bash
railway variables set FRONTEND_URL="<vercel_url_from_step_3>"
railway redeploy
```

### Step 5 — Print all URLs
```
==============================================================
WAREHOUSEVOICE DEPLOYMENT COMPLETE
==============================================================
Picker PWA (Vercel):     https://warehousevoice.vercel.app
API Backend (Railway):   https://warehousevoice-backend.railway.app
Supabase Dashboard:      https://app.supabase.com/project/njjrldbhcrbuazvmupaz
==============================================================
```

---

## 10. Explicit NON-requirements (do NOT build these)

- No authentication or login system
- No "Open in ERP" button anywhere in the UI
- No operation selector on picker (ADD/REMOVE/REPLACE comes from voice/Gemini)
- No dark mode — light theme only
- No unit tests
- No barcode scanning
- No email or push notifications (ping button is UI-only for MVP)
- No real-time websocket (polling is sufficient for MVP)

---

## 11. Final checklist before printing URLs

- [ ] Supabase migrations applied, all tables exist, seed data inserted
- [ ] Storage bucket `bill-photos` created and accessible
- [ ] `GET /health` returns 200 on Railway
- [ ] `POST /api/ocr` returns bill_number field from a test JPEG
- [ ] `POST /api/transcribe` returns operations array from test audio
- [ ] Frontend `npm run build` completes with no errors
- [ ] PWA manifest loads in browser (check Chrome DevTools → Application → Manifest)
- [ ] CORS allows Vercel URL (test with fetch from browser console)
- [ ] All 6 environment variables set on Railway (`railway variables list`)
- [ ] Vercel URL loads the app and shows the blue topbar with mode tabs
