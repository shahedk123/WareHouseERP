/**
 * Import Polosys product master XLS into WarehouseOS database.
 * Usage: node scripts/import-polosys.js <path-to-xls>
 *
 * What it does:
 *  1. Reads product groups   → upserts into product_groups
 *  2. Reads product categories → upserts into product_categories
 *  3. Reads products         → upserts into products (by code)
 *
 * Safe to re-run: all operations use INSERT ... ON CONFLICT DO UPDATE.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseTaxRate(taxCategory) {
  if (!taxCategory) return { tax_rate: 0, tax_type: 'EXEMPT' };
  const match = String(taxCategory).match(/(\d+(\.\d+)?)/);
  if (match) return { tax_rate: parseFloat(match[1]), tax_type: 'VAT' };
  return { tax_rate: 0, tax_type: 'EXEMPT' };
}

function normaliseUnit(unit) {
  if (!unit) return 'pcs';
  return String(unit).toLowerCase().trim();
}

function isActive(val) {
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() === 'checked';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/import-polosys.js <path-to-xls>');
    process.exit(1);
  }

  console.log(`\n📂 Reading: ${filePath}`);
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Row 0 = company header, Row 1 = column headers, Row 2+ = data
  const headers = raw[1];
  const rows = raw.slice(2).map(r => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = r[i] ?? null; });
    return obj;
  }).filter(r => r['Product Code'] || r['Product']); // skip blank rows

  console.log(`✅ Parsed ${rows.length} product rows\n`);

  // ── Step 1: Product Groups ─────────────────────────────────────────────────
  const groupNames = [...new Set(rows.map(r => r['Group Name']).filter(Boolean))];
  console.log(`📁 Upserting ${groupNames.length} product groups...`);

  const { data: groupRows, error: gErr } = await supabase
    .from('product_groups')
    .upsert(
      groupNames.map((name, i) => ({ name, sort_order: i })),
      { onConflict: 'name', ignoreDuplicates: false }
    )
    .select('id, name');

  if (gErr) { console.error('❌ Groups error:', gErr.message); process.exit(1); }

  const groupMap = {}; // name → id
  groupRows.forEach(g => { groupMap[g.name] = g.id; });
  console.log(`   ✅ ${groupRows.length} groups ready\n`);

  // ── Step 2: Product Categories ─────────────────────────────────────────────
  // Unique (groupName, categoryName) pairs
  const catPairs = [];
  const seen = new Set();
  for (const r of rows) {
    const key = `${r['Group Name']}||${r['Category']}`;
    if (!seen.has(key) && r['Category']) {
      seen.add(key);
      catPairs.push({ group_name: r['Group Name'], name: r['Category'] });
    }
  }

  console.log(`🗂  Upserting ${catPairs.length} product categories...`);
  const catInserts = catPairs.map(c => ({
    group_id: groupMap[c.group_name] || null,
    name: c.name,
  }));

  // Upsert categories — no unique constraint on (group_id, name) by default,
  // so we fetch existing first to avoid duplicates on re-run.
  const { data: existingCats } = await supabase
    .from('product_categories')
    .select('id, name, group_id');

  const existingCatMap = {}; // `groupId||name` → id
  (existingCats || []).forEach(c => {
    existingCatMap[`${c.group_id}||${c.name}`] = c.id;
  });

  const newCats = catInserts.filter(
    c => !existingCatMap[`${c.group_id}||${c.name}`]
  );

  let catMap = { ...existingCatMap }; // will be keyed by groupId||name → id

  if (newCats.length > 0) {
    const { data: insertedCats, error: cErr } = await supabase
      .from('product_categories')
      .insert(newCats)
      .select('id, name, group_id');

    if (cErr) { console.error('❌ Categories error:', cErr.message); process.exit(1); }
    (insertedCats || []).forEach(c => {
      catMap[`${c.group_id}||${c.name}`] = c.id;
    });
  }

  console.log(`   ✅ Categories ready (${newCats.length} new)\n`);

  // ── Step 3: Products ───────────────────────────────────────────────────────
  console.log(`📦 Importing ${rows.length} products...`);

  const products = rows.map(r => {
    const groupId = groupMap[r['Group Name']] || null;
    const catId = catMap[`${groupId}||${r['Category']}`] || null;
    const { tax_rate, tax_type } = parseTaxRate(r['Tax Category']);

    return {
      code:          String(r['Product Code'] || r['Product ID']).trim(),
      name:          String(r['Product'] || '').trim(),
      name_alt:      r['Arabic Name'] ? String(r['Arabic Name']).trim() : null,
      group_id:      groupId,
      category_id:   catId,
      unit:          normaliseUnit(r['Unit']),
      hsn_code:      r['HSN Code'] ? String(r['HSN Code']).trim() : null,
      tax_rate,
      tax_type,
      purchase_rate: r['Purchase Price'] != null ? parseFloat(r['Purchase Price']) : null,
      selling_rate:  r['Sales Price'] != null ? parseFloat(r['Sales Price']) : null,
      reorder_qty:   r['Re Order Qty'] != null ? parseInt(r['Re Order Qty']) : 0,
      current_stock: r['Stock'] != null ? parseFloat(r['Stock']) : 0,
      active:        isActive(r['Is Active']),
    };
  }).filter(p => p.code && p.name); // must have code + name

  // Upsert in batches of 200
  const BATCH = 200;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const { error: pErr } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'code', ignoreDuplicates: false });

    if (pErr) {
      console.error(`❌ Batch ${i}–${i + BATCH} error:`, pErr.message);
      errors += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Upserted ${imported}/${products.length}...`);
    }
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`   Products imported : ${imported}`);
  if (errors > 0) console.log(`   Errors           : ${errors}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Database now has ${totalProducts} products`);
  console.log(`   Groups  : ${groupNames.length}`);
  console.log(`   Active  : ${products.filter(p => p.active).length}`);
  console.log(`   In-stock: ${products.filter(p => p.current_stock > 0).length}`);
  console.log('\n🎉 Done!\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
