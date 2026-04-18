const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { authorize } = require('../../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/erp/products — list products
router.get('/', async (req, res) => {
  try {
    const { search, group_id, category_id, active = true } = req.query;

    let query = supabase.from('products').select('*');

    if (active !== 'false') {
      query = query.eq('active', true);
    }

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,name_alt.ilike.%${search}%`);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/products/:id — get single product
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/products — create product
router.post('/', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { code, name, name_alt, group_id, category_id, unit, hsn_code, tax_rate, tax_type, purchase_rate, selling_rate, reorder_qty } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'code and name required' });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        code,
        name,
        name_alt,
        group_id,
        category_id,
        unit: unit || 'pcs',
        hsn_code,
        tax_rate: tax_rate || 18,
        tax_type: tax_type || 'GST',
        purchase_rate: purchase_rate || 0,
        selling_rate: selling_rate || 0,
        reorder_qty: reorder_qty || 0,
        current_stock: 0,
        active: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Product code already exists: ${code}` });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/erp/products/:id — update product
router.put('/:id', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { code, name, name_alt, group_id, category_id, unit, hsn_code, tax_rate, tax_type, purchase_rate, selling_rate, reorder_qty, active } = req.body;

    const { data, error } = await supabase
      .from('products')
      .update({
        code,
        name,
        name_alt,
        group_id,
        category_id,
        unit,
        hsn_code,
        tax_rate,
        tax_type,
        purchase_rate,
        selling_rate,
        reorder_qty,
        active
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/erp/products/:id — soft delete product
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ active: false })
      .eq('id', req.params.id);

    if (error) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/products/low-stock — low stock alerts
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .lte('current_stock', 'reorder_qty')
      .order('current_stock');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Product Groups ────────────────────────────────────────────

// GET /api/erp/product-groups
router.get('/groups/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('product_groups')
      .select('*')
      .order('sort_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/product-groups
router.post('/groups/create', authorize('admin'), async (req, res) => {
  try {
    const { name, icon, sort_order } = req.body;

    const { data, error } = await supabase
      .from('product_groups')
      .insert({ name, icon: icon || 'box', sort_order: sort_order || 0 })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Product Categories ────────────────────────────────────────

// GET /api/erp/product-categories
router.get('/categories/list', async (req, res) => {
  try {
    const { group_id } = req.query;
    let query = supabase.from('product_categories').select('*');

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/product-categories
router.post('/categories/create', authorize('admin'), async (req, res) => {
  try {
    const { group_id, name } = req.body;

    const { data, error } = await supabase
      .from('product_categories')
      .insert({ group_id, name })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── XLS/XLSX Import ──────────────────────────────────────────
// POST /api/erp/products/import  (multipart: field name = "file")
router.post('/import', authorize('admin', 'accountant'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Detect header row: look for row containing "Product Code"
    let headerRowIdx = raw.findIndex(r => r.includes('Product Code'));
    if (headerRowIdx === -1) headerRowIdx = 0;
    const headers = raw[headerRowIdx];
    const dataRows = raw.slice(headerRowIdx + 1);

    const rows = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = r[i] ?? null; });
      return obj;
    }).filter(r => r['Product Code'] || r['Product']);

    // ── Groups ──────────────────────────────────────────────────
    const groupNames = [...new Set(rows.map(r => r['Group Name']).filter(Boolean))];
    let groupMap = {};

    if (groupNames.length > 0) {
      const { data: existingGroups } = await supabase
        .from('product_groups').select('id, name');
      existingGroups.forEach(g => { groupMap[g.name] = g.id; });

      const newGroups = groupNames.filter(n => !groupMap[n]);
      if (newGroups.length > 0) {
        const { data: inserted } = await supabase
          .from('product_groups')
          .insert(newGroups.map((name, i) => ({ name, sort_order: i })))
          .select('id, name');
        (inserted || []).forEach(g => { groupMap[g.name] = g.id; });
      }
    }

    // ── Categories ──────────────────────────────────────────────
    const { data: existingCats } = await supabase
      .from('product_categories').select('id, name, group_id');
    const catMap = {};
    (existingCats || []).forEach(c => { catMap[`${c.group_id}||${c.name}`] = c.id; });

    const catPairs = [];
    const seenCats = new Set();
    for (const r of rows) {
      const key = `${r['Group Name']}||${r['Category']}`;
      if (!seenCats.has(key) && r['Category']) {
        seenCats.add(key);
        catPairs.push({ group_id: groupMap[r['Group Name']] || null, name: r['Category'] });
      }
    }
    const newCats = catPairs.filter(c => !catMap[`${c.group_id}||${c.name}`]);
    if (newCats.length > 0) {
      const { data: inserted } = await supabase
        .from('product_categories').insert(newCats).select('id, name, group_id');
      (inserted || []).forEach(c => { catMap[`${c.group_id}||${c.name}`] = c.id; });
    }

    // ── Products ────────────────────────────────────────────────
    const products = rows.map(r => {
      const groupId = groupMap[r['Group Name']] || null;
      const catId = catMap[`${groupId}||${r['Category']}`] || null;
      const taxStr = String(r['Tax Category'] || '');
      const taxMatch = taxStr.match(/(\d+(\.\d+)?)/);
      const tax_rate = taxMatch ? parseFloat(taxMatch[1]) : 0;
      const tax_type = tax_rate > 0 ? 'VAT' : 'EXEMPT';

      return {
        code:          String(r['Product Code'] || r['Product ID']).trim(),
        name:          String(r['Product'] || '').trim(),
        name_alt:      r['Arabic Name'] ? String(r['Arabic Name']).trim() : null,
        group_id:      groupId,
        category_id:   catId,
        unit:          r['Unit'] ? String(r['Unit']).toLowerCase().trim() : 'pcs',
        hsn_code:      r['HSN Code'] ? String(r['HSN Code']).trim() : null,
        tax_rate,
        tax_type,
        purchase_rate: r['Purchase Price'] != null ? parseFloat(r['Purchase Price']) : null,
        selling_rate:  r['Sales Price'] != null ? parseFloat(r['Sales Price']) : null,
        reorder_qty:   r['Re Order Qty'] != null ? parseInt(r['Re Order Qty']) : 0,
        current_stock: r['Stock'] != null ? parseFloat(r['Stock']) : 0,
        active:        String(r['Is Active'] || '').toLowerCase() === 'checked',
      };
    }).filter(p => p.code && p.name);

    const BATCH = 200;
    let imported = 0;
    const errors = [];

    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);
      const { error: pErr } = await supabase
        .from('products')
        .upsert(batch, { onConflict: 'code' });
      if (pErr) errors.push(pErr.message);
      else imported += batch.length;
    }

    res.json({
      ok: true,
      imported,
      groups: groupNames.length,
      categories: catPairs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
