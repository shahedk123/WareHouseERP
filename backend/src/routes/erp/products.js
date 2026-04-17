const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authorize } = require('../../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/erp/products — list products
router.get('/', async (req, res) => {
  try {
    const { search, group_id, active = true } = req.query;

    let query = supabase.from('products').select('*');

    if (active !== 'false') {
      query = query.eq('active', true);
    }

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
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

module.exports = router;
