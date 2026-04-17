require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3001;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const geminiAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

app.use(express.json());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean),
  credentials: true
}));

const upload = multer({ storage: multer.memoryStorage() });

// ─── Background cleanup: purge resolved/rejected older than 7 days ────────────
function runCleanup() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  supabase.from('pending_modifications')
    .delete()
    .or('resolved.eq.true,rejected.eq.true')
    .lt('created_at', cutoff)
    .then(({ error }) => { if (error) console.error('Cleanup error:', error.message); });
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ─── OCR ──────────────────────────────────────────────────────────────────────
app.post('/api/ocr', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    const compressed = await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const storagePath = `bills/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('bill-photos')
      .upload(storagePath, compressed, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { data: signedData, error: signedError } = await supabase.storage
      .from('bill-photos')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

    if (signedError) throw signedError;
    const photoUrl = signedData.signedUrl;

    const base64 = compressed.toString('base64');
    const ocrPrompt = `Extract bill/invoice details from this image.
Return ONLY valid JSON with no markdown fences:
{
  "bill_number": "invoice or bill ID as printed, or null",
  "customer_name": "company or customer name, or null",
  "customer_location": "address, city or phone if visible, or null"
}`;

    let parsed = { bill_number: null, customer_name: null, customer_location: null };
    try {
      const result = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: ocrPrompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }],
        max_tokens: 256,
        temperature: 0.1
      });
      let text = result.choices[0].message.content.trim();
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(text);
    } catch (_) {}

    res.json({
      bill_number: parsed.bill_number || null,
      customer_name: parsed.customer_name || null,
      customer_location: parsed.customer_location || null,
      photo_url: photoUrl,
      photo_storage_path: storagePath
    });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Shared: build catalog context from transcript keywords ──────────────────
async function fetchCatalogContext(transcriptOrHint) {
  try {
    const stopWords = new Set([
      'add','remove','replace','the','and','for','with','box','boxes','carton','cartons','bale','bales','dozen','piece','pieces','tin','tins',
      'أضف','أزل','استبدل','من','في','على','إلى','و','كرتون','كراتين','بالة','دزينة','قطعة',
      'ചേർക്കൂ','നീക്കൂ','മാറ്റൂ','ഉം','ഒരു','കാർട്ടൺ','ഡസൻ','ബേൽ'
    ]);
    const keywords = transcriptOrHint.split(/[\s,،.。]+/)
      .map(w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(w => w.length >= 2 && !stopWords.has(w));

    let items = [];
    if (keywords.length > 0) {
      const bigrams = [];
      for (let i = 0; i < keywords.length - 1; i++) bigrams.push(keywords[i] + ' ' + keywords[i + 1]);
      const terms = [...new Set([...keywords.slice(0, 8), ...bigrams.slice(0, 4)])];
      const orFilters = terms.flatMap(kw => [`name_en.ilike.%${kw}%`, `alt_names.ilike.%${kw}%`]).join(',');
      const { data } = await supabase.from('product_catalog')
        .select('code, name_en, unit, alt_names').or(orFilters).limit(30);
      if (data?.length) items = data;
    }
    if (items.length < 10) {
      const { data: fb } = await supabase.from('product_catalog')
        .select('code, name_en, unit, alt_names').limit(15);
      const seen = new Set(items.map(p => p.code));
      for (const p of fb || []) if (!seen.has(p.code)) items.push(p);
    }
    return items.map(p => {
      let line = `  ${p.code}: ${p.name_en} (${p.unit})`;
      if (p.alt_names) line += ` [also: ${p.alt_names}]`;
      return line;
    }).join('\n');
  } catch (_) { return ''; }
}

const DOMAIN_CONTEXT = `You are a multilingual warehouse picking assistant for a plastic goods and disposables warehouse in Mecca, Saudi Arabia. Workers speak Arabic, Malayalam, or English.

PRODUCT TYPES in this warehouse:
- WARAGA (ورقا / وركا): disposable plates/cups/paper goods — unit: CTN
- KEES (كيس / زمبيل): plastic bags, various sizes (price in SAR) — unit: CTN or BALA
- WATER CUP (كاسأ ماء / كاس): plastic drinking cups — unit: CTN
- MASAHA (مساحة): mops, squeegees, cleaning tools — unit: DARZAN
- MANADEEL (مناديل): tissues, napkins, paper towels — unit: BALA or CTN
- SILK KEES (سيلك نهيم): heavy-duty silk bags — unit: BALA
- THURAMBA (طورمبا): pumps, dispensers — unit: DARZAN or PCs
- ULBA (علبة): tinned/canned goods — unit: ULBA

PACKING UNITS:
- CTN = carton / box / كرتون / cartoon / kartun / കാർട്ടൺ
- BALA = bale / bundle / بالة / بيلة / ബേൽ
- DARZAN = dozen / دزينة / ഡസൻ
- PCs = piece / قطعة / piecs
- ULBA = tin / can / علبة

PHONETIC MATCHES (Whisper often mishears these):
- "gander/gandu/gandura" → GANDOURA
- "thayyar/fayir/thayer" → THAYYAR (كيس 15)
- "regqa/rikka/rika/rakka" → WARAGA (ورقا)
- "garabiya/gharabiya/gare baya" → GARABIYA (الغربية)
- "jeddah/jedda" → JEDDAH
- "naheem/naeem" → NAHEEM (silk kees)`;

// ─── Transcribe + NLU — Gemini primary, Groq fallback ────────────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });

    const uiLang = req.body?.language || 'en';
    const mimeType = req.file.mimetype || 'audio/webm';
    const audioB64 = req.file.buffer.toString('base64');

    const langHint = uiLang === 'ar' ? 'Arabic' : uiLang === 'ml' ? 'Malayalam' : 'English';

    // ── Gemini path (primary) ────────────────────────────────────────────────
    if (geminiAI) {
      try {
        // First pass: transcribe only (fast, accurate)
        const transcribeModel = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const transcribeResult = await transcribeModel.generateContent([
          `This is a warehouse worker recording in ${langHint}. Transcribe the audio exactly as spoken. Return ONLY the transcription text, nothing else.`,
          { inlineData: { mimeType, data: audioB64 } }
        ]);
        const transcript = transcribeResult.response.text().trim();

        // Fetch catalog context based on transcription
        const catalogContext = await fetchCatalogContext(transcript);

        // Second pass: NLU with full context
        const nluPrompt = `${DOMAIN_CONTEXT}

PRODUCT CATALOG — match spoken names to these codes ONLY:
${catalogContext || '  (no catalog loaded)'}

SPOKEN STATEMENT (${langHint}): "${transcript}"

Extract ALL product operations. Return ONLY a valid JSON array (no markdown fences):
[{"action_type":"ADD"|"REMOVE"|"REPLACE","product_hint":"English product name","quantity":number|null,"matched_product_code":"exact code from catalog above or null"}]

RULES:
- ADD = adding to bill (add / أضف / ارفع / ചേർക്കൂ / കൂട്ടൂ)
- REMOVE = removing from bill (remove / أزل / احذف / നീക്കൂ / കുറയ്ക്കൂ)
- REPLACE = swap one item for another
- quantity = the NUMBER spoken — ignore the unit word (carton/bala/dozen is the unit, not quantity)
- matched_product_code = ONLY use codes from the PRODUCT CATALOG above. NEVER invent a code.
- Use phonetic matching for misheared names (see PHONETIC MATCHES above)
- product_hint always in English
- Always return an array`;

        const nluModel = geminiAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        });
        const nluResult = await nluModel.generateContent(nluPrompt);
        let nluText = nluResult.response.text().trim()
          .replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        let operations = JSON.parse(nluText);
        if (!Array.isArray(operations)) throw new Error('Not array');

        // Enrich with product info from DB
        const codes = operations.map(o => o.matched_product_code).filter(Boolean);
        let productInfo = {};
        if (codes.length > 0) {
          const { data } = await supabase.from('product_catalog')
            .select('code, name_en, unit').in('code', codes);
          for (const p of data || []) productInfo[p.code] = { name: p.name_en, unit: p.unit };
        }

        return res.json({
          transcript,
          stt_provider: 'gemini-2.0-flash',
          operations: operations.map(op => ({
            ...op,
            matched_product_name: op.matched_product_code ? (productInfo[op.matched_product_code]?.name || null) : null,
            matched_product_unit: op.matched_product_code ? (productInfo[op.matched_product_code]?.unit || null) : null
          }))
        });
      } catch (geminiErr) {
        console.warn('Gemini failed, falling back to Groq:', geminiErr.message);
      }
    }

    // ── Groq Whisper fallback ────────────────────────────────────────────────
    const { File } = await import('node:buffer');
    const audioFile = new File([req.file.buffer], 'recording.webm', { type: mimeType });
    const whisperLang = (uiLang === 'ml' || uiLang === 'ar') ? uiLang : undefined;
    const whisperPrompt = uiLang === 'ar'
      ? 'مستودع بضائع بلاستيكية. ورقا، كيس، كاسأ ماء، غندورة، مساحة، مناديل، بالة، دزينة، كرتون.'
      : uiLang === 'ml'
      ? 'പ്ലാസ്റ്റിക് വേർഹൗസ്. വർക്ക, കീസ്, വാട്ടർ കപ്പ്, ഗന്ദൂര, മസഹ, കാർട്ടൺ, ബാല, ഡസൻ.'
      : 'Plastic goods warehouse. waraga, kees, water cup, gandoura, masaha, manadeel, silk kees, bala, darzan.';

    const transcribeParams = { file: audioFile, model: 'whisper-large-v3', response_format: 'json', prompt: whisperPrompt };
    if (whisperLang) transcribeParams.language = whisperLang;
    const transcription = await groq.audio.transcriptions.create(transcribeParams);
    const transcript = transcription.text || '';

    const catalogContext = await fetchCatalogContext(transcript);

    // Compact prompt for Groq — DOMAIN_CONTEXT is the system message, catalog+statement in user message
    const nluSystem = `You are a warehouse picking assistant (plastic goods, Mecca). Extract inventory operations from spoken statements in Arabic, Malayalam, or English. Return ONLY a JSON array.
Units: CTN=carton/box/كرتون, BALA=bale/bundle/بالة, DARZAN=dozen/دزينة, PCs=piece/قطعة, ULBA=tin/علبة.
Phonetics: gander/gandu≈GANDOURA, fayir/thayyar≈THAYYAR, rikka/regqa/waraga≈WARAGA, garabiya≈GARABIYA.
ADD=add/أضف/ارفع/ചേർക്കൂ, REMOVE=remove/أزل/احذف/നീക്കൂ, REPLACE=swap/استبدل/മാറ്റൂ.
quantity=the number only (ignore carton/bala/dozen). matched_product_code=ONLY use codes from catalog, never invent.`;

    const nluUser = `CATALOG:\n${catalogContext || '(empty)'}\n\nSTATEMENT: "${transcript}"\n\nReturn JSON array (action_type must be ADD, REMOVE, or REPLACE):\n[{"action_type":"ADD","product_hint":"English name","quantity":5,"matched_product_code":"CODE"}]`;

    let operations = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: nluSystem },
            { role: 'user', content: nluUser }
          ],
          max_tokens: 512, temperature: 0.1
        });
        let text = r.choices[0].message.content.trim()
          .replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        operations = JSON.parse(text);
        if (!Array.isArray(operations)) throw new Error('Not array');
        break;
      } catch (nluErr) {
        console.error(`NLU attempt ${attempt} failed:`, nluErr?.status, nluErr?.message?.slice(0, 120));
        if (attempt === 1) operations = [{ action_type: 'ADD', product_hint: transcript, quantity: null, matched_product_code: null }];
      }
    }

    const codes = operations.map(o => o.matched_product_code).filter(Boolean);
    let productInfo = {};
    if (codes.length > 0) {
      const { data } = await supabase.from('product_catalog').select('code, name_en, unit').in('code', codes);
      for (const p of data || []) productInfo[p.code] = { name: p.name_en, unit: p.unit };
    }

    res.json({
      transcript,
      stt_provider: 'groq-whisper',
      operations: operations.map(op => ({
        ...op,
        matched_product_name: op.matched_product_code ? (productInfo[op.matched_product_code]?.name || null) : null,
        matched_product_unit: op.matched_product_code ? (productInfo[op.matched_product_code]?.unit || null) : null
      }))
    });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Submit modifications ─────────────────────────────────────────────────────
app.post('/api/modifications', async (req, res) => {
  try {
    const { bill_number, customer_name, customer_sub, photo_url, photo_storage_path, picker_name, operations } = req.body;

    const { error: billError } = await supabase
      .from('bills')
      .upsert({ bill_number, customer_name, customer_sub, photo_url, picker_name },
        { onConflict: 'bill_number' });

    if (billError) throw billError;

    const rows = (operations || []).map(op => ({
      bill_number,
      customer_name,
      customer_sub,
      raw_statement: op.raw_statement || op.product_hint,
      action_type: op.action_type,
      product_hint: op.product_hint,
      quantity: op.quantity,
      picker_name,
      photo_url,
      photo_storage_path,
      nlu_product_code: op.matched_product_code || null
    }));

    if (rows.length > 0) {
      const { error: modsError } = await supabase.from('pending_modifications').insert(rows);
      if (modsError) throw modsError;
    }

    res.json({ success: true, inserted: rows.length });
  } catch (err) {
    console.error('Submit modifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get pending modifications ────────────────────────────────────────────────
app.get('/api/modifications', async (req, res) => {
  try {
    runCleanup();

    // Try with rejected filter; fall back gracefully if column not yet migrated
    let { data, error } = await supabase
      .from('pending_modifications')
      .select('*')
      .eq('resolved', false)
      .or('rejected.is.null,rejected.eq.false')
      .order('created_at', { ascending: true });

    if (error && (error.message?.includes('rejected') || error.code === '42703')) {
      const fallback = await supabase
        .from('pending_modifications')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const billMap = new Map();
    for (const mod of data) {
      if (!billMap.has(mod.bill_number)) {
        billMap.set(mod.bill_number, {
          bill_number: mod.bill_number,
          customer_name: mod.customer_name,
          customer_sub: mod.customer_sub,
          photo_url: mod.photo_url,
          modifications: [],
          oldest_ts: mod.created_at
        });
      }
      billMap.get(mod.bill_number).modifications.push({
        id: mod.id,
        action_type: mod.action_type,
        product_hint: mod.product_hint,
        quantity: mod.quantity,
        picker_name: mod.picker_name,
        created_at: mod.created_at,
        resolved: mod.resolved,
        rejected: mod.rejected || false,
        nlu_product_code: mod.nlu_product_code || null,
        raw_statement: mod.raw_statement
      });
    }

    const bills = Array.from(billMap.values()).sort(
      (a, b) => new Date(a.oldest_ts) - new Date(b.oldest_ts)
    );

    res.json({ bills });
  } catch (err) {
    console.error('Get modifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get resolved modifications ───────────────────────────────────────────────
app.get('/api/modifications/resolved', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('pending_modifications')
      .select('id, bill_number, customer_name, product_hint, quantity, action_type, resolved_at, matched_product_name, matched_product_code, photo_url, resolved_by, created_at')
      .eq('resolved', true)
      .gte('resolved_at', since)
      .order('resolved_at', { ascending: false });

    if (error) throw error;
    res.json({ modifications: data });
  } catch (err) {
    console.error('Resolved mods error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get rejected modifications ───────────────────────────────────────────────
app.get('/api/modifications/rejected', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('pending_modifications')
      .select('id, bill_number, customer_name, product_hint, quantity, action_type, rejected_at, rejected_by, photo_url, created_at')
      .eq('rejected', true)
      .gte('rejected_at', since)
      .order('rejected_at', { ascending: false });

    if (error) throw error;
    res.json({ modifications: data });
  } catch (err) {
    console.error('Rejected mods error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Resolve modification ─────────────────────────────────────────────────────
app.patch('/api/modifications/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, product_code, product_unit, resolved_by } = req.body;

    const { data: row, error: fetchError } = await supabase
      .from('pending_modifications')
      .select('bill_number, photo_storage_path')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from('pending_modifications')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        matched_product_name: product_name,
        matched_product_code: product_code,
        matched_product_unit: product_unit,
        resolved_by
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Delete photo only if all mods for this bill are resolved or rejected
    const { count, error: countError } = await supabase
      .from('pending_modifications')
      .select('id', { count: 'exact', head: true })
      .eq('bill_number', row.bill_number)
      .eq('resolved', false)
      .or('rejected.is.null,rejected.eq.false');

    if (countError) throw countError;

    if (count === 0 && row.photo_storage_path) {
      await supabase.storage.from('bill-photos').remove([row.photo_storage_path]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Resolve error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Reject modification ──────────────────────────────────────────────────────
app.patch('/api/modifications/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejected_by } = req.body;

    const { error } = await supabase
      .from('pending_modifications')
      .update({
        rejected: true,
        rejected_at: new Date().toISOString(),
        rejected_by: rejected_by || 'Accountant'
      })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Catalog search ───────────────────────────────────────────────────────────
app.get('/api/catalog', async (req, res) => {
  try {
    const q = req.query.q;
    let query = supabase.from('product_catalog').select('id, name_en, name_ml, code, unit, category');

    if (q) {
      query = query.or(
        `name_en.ilike.%${q}%,name_ml.ilike.%${q}%,code.ilike.%${q}%,category.ilike.%${q}%,alt_names.ilike.%${q}%`
      ).limit(8);
    } else {
      query = query.limit(10);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Catalog error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Catalog CSV upload ───────────────────────────────────────────────────────
app.post('/api/catalog/upload', upload.single('file'), async (req, res) => {
  try {
    const filename = (req.file.originalname || '').toLowerCase();
    let records;

    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      const XLSX = require('xlsx');
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      records = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      const { parse } = require('csv-parse/sync');
      records = parse(req.file.buffer, { columns: true, skip_empty_lines: true });
    }

    const rows_mapped = records
      .map(row => ({
        name_en: String(row.Name_EN || '').trim(),
        name_ml: row.Name_ML ? String(row.Name_ML).trim() : null,
        code: String(row.Code || '').trim(),
        unit: String(row.Unit || '').trim(),
        category: row.Category ? String(row.Category).trim() : null,
        alt_names: row.Alt_Names ? String(row.Alt_Names).trim() : null
      }))
      .filter(r => r.code && r.name_en);

    // Batch upsert in chunks of 200
    const CHUNK = 200;
    let inserted = 0;
    const errors = [];
    for (let i = 0; i < rows_mapped.length; i += CHUNK) {
      const chunk = rows_mapped.slice(i, i + CHUNK);
      const { error, data } = await supabase.from('product_catalog').upsert(chunk, { onConflict: 'code' });
      if (error) errors.push(error.message);
      else inserted += chunk.length;
    }

    res.json({ inserted, updated: 0, errors });
  } catch (err) {
    console.error('CSV upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Metrics (for manager) ────────────────────────────────────────────────────
app.get('/api/metrics', async (req, res) => {
  try {
    const todayStart = new Date().toISOString().slice(0, 10);
    const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Helper: run count query, return 0 on column-missing error
    const safeCount = async (q) => {
      const r = await q;
      return (r.error && (r.error.message?.includes('rejected') || r.error.code === '42703')) ? { count: 0 } : r;
    };
    const safeData = async (q) => {
      const r = await q;
      return (r.error && (r.error.message?.includes('rejected') || r.error.code === '42703')) ? { data: [] } : r;
    };

    const [
      { count: bills_today },
      { count: resolved_today },
      { count: rejected_today },
      { count: pending_total },
      { data: staleMods },
      { data: resolvedToday },
      { data: pickerMods },
      { data: recentMods }
    ] = await Promise.all([
      supabase.from('bills').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('pending_modifications').select('id', { count: 'exact', head: true }).eq('resolved', true).gte('resolved_at', todayStart),
      safeCount(supabase.from('pending_modifications').select('id', { count: 'exact', head: true }).eq('rejected', true).gte('rejected_at', todayStart)),
      safeCount(supabase.from('pending_modifications').select('id', { count: 'exact', head: true }).eq('resolved', false).or('rejected.is.null,rejected.eq.false')).then(r => r.error ? supabase.from('pending_modifications').select('id', { count: 'exact', head: true }).eq('resolved', false) : r),
      safeData(supabase.from('pending_modifications').select('bill_number, customer_name, customer_sub, picker_name, created_at').eq('resolved', false).or('rejected.is.null,rejected.eq.false').lt('created_at', staleThreshold)).then(r => r.data === undefined ? supabase.from('pending_modifications').select('bill_number, customer_name, customer_sub, picker_name, created_at').eq('resolved', false).lt('created_at', staleThreshold) : r),
      supabase.from('pending_modifications').select('created_at, resolved_at').eq('resolved', true).gte('resolved_at', todayStart),
      safeData(supabase.from('pending_modifications').select('picker_name, resolved, rejected').gte('created_at', todayStart)).then(r => r.data === undefined ? supabase.from('pending_modifications').select('picker_name, resolved').gte('created_at', todayStart) : r),
      safeData(supabase.from('pending_modifications').select('created_at, resolved, resolved_at, rejected, rejected_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())).then(r => r.data === undefined ? supabase.from('pending_modifications').select('created_at, resolved, resolved_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) : r)
    ]);

    // Stale bills
    const staleMap = new Map();
    for (const m of staleMods || []) {
      if (!staleMap.has(m.bill_number)) {
        staleMap.set(m.bill_number, { bill_number: m.bill_number, customer_name: m.customer_name, customer_sub: m.customer_sub, mod_count: 0, oldest_ts: m.created_at });
      }
      const entry = staleMap.get(m.bill_number);
      entry.mod_count++;
      if (new Date(m.created_at) < new Date(entry.oldest_ts)) entry.oldest_ts = m.created_at;
    }
    const stale_bills = Array.from(staleMap.values()).map(b => ({
      ...b,
      age_minutes: Math.floor((Date.now() - new Date(b.oldest_ts)) / 60000)
    }));

    // Avg resolve time
    let avg_resolve_minutes = 0;
    if (resolvedToday?.length > 0) {
      const total = resolvedToday.reduce((sum, m) => sum + (new Date(m.resolved_at) - new Date(m.created_at)), 0);
      avg_resolve_minutes = Math.round(total / resolvedToday.length / 60000);
    }

    // Picker activity
    const pickerMap = new Map();
    for (const m of pickerMods || []) {
      if (!m.picker_name) continue;
      if (!pickerMap.has(m.picker_name)) pickerMap.set(m.picker_name, { submitted: 0, resolved: 0, rejected: 0, pending: 0 });
      const p = pickerMap.get(m.picker_name);
      p.submitted++;
      if (m.resolved) p.resolved++;
      else if (m.rejected) p.rejected++;
      else p.pending++;
    }
    const picker_activity = Array.from(pickerMap.entries())
      .map(([picker_name, stats]) => ({ picker_name, ...stats }))
      .sort((a, b) => b.submitted - a.submitted);

    // Throughput by hour
    const hourMap = new Map();
    for (const m of resolvedToday || []) {
      const hour = new Date(m.resolved_at).getHours().toString().padStart(2, '0');
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }
    const throughput_by_hour = Array.from(hourMap.entries())
      .map(([hour, resolved]) => ({ hour, resolved }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // By date (last 7 days)
    const dateMap = new Map();
    for (const m of recentMods || []) {
      const date = m.created_at.slice(0, 10);
      if (!dateMap.has(date)) dateMap.set(date, { date, submitted: 0, resolved: 0, rejected: 0, pending: 0 });
      const d = dateMap.get(date);
      d.submitted++;
      if (m.resolved) d.resolved++;
      else if (m.rejected) d.rejected++;
      else d.pending++;
    }
    const by_date = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    const is_end_of_day = new Date().getHours() >= 18;

    res.json({
      bills_today: bills_today || 0,
      resolved_today: resolved_today || 0,
      rejected_today: rejected_today || 0,
      pending_total: pending_total || 0,
      stale_count: stale_bills.length,
      avg_resolve_minutes,
      stale_bills,
      picker_activity,
      throughput_by_hour,
      by_date,
      is_end_of_day
    });
  } catch (err) {
    console.error('Metrics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`WarehouseVoice backend on port ${PORT}`));
