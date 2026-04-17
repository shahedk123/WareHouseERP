const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authorize } = require('../../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/erp/reports/stock-summary — current stock levels by product
router.get('/stock-summary', async (req, res) => {
  try {
    const { group_id, low_stock = false } = req.query;

    let query = supabase
      .from('products')
      .select('id, code, name, unit, current_stock, reorder_qty, purchase_rate, selling_rate, group_id')
      .eq('active', true);

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    if (low_stock === 'true') {
      query = query.lte('current_stock', 'reorder_qty');
    }

    const { data, error } = await query.order('current_stock');
    if (error) throw error;

    const summary = {
      total_products: data ? data.length : 0,
      in_stock: data ? data.filter(p => p.current_stock > 0).length : 0,
      low_stock: data ? data.filter(p => p.current_stock <= p.reorder_qty && p.current_stock > 0).length : 0,
      out_of_stock: data ? data.filter(p => p.current_stock === 0).length : 0,
      products: data || []
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/reports/sales-register — sales invoices register
router.get('/sales-register', authorize('admin', 'accountant', 'manager'), async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('type', 'sale')
      .gte('invoice_date', fromDate)
      .lte('invoice_date', toDate)
      .order('invoice_date');

    if (error) throw error;

    const register = {
      from: fromDate,
      to: toDate,
      invoices: invoices || [],
      totals: {
        count: invoices ? invoices.length : 0,
        subtotal: 0,
        discount: 0,
        taxable: 0,
        tax: 0,
        total: 0
      }
    };

    for (const inv of register.invoices) {
      register.totals.subtotal += inv.subtotal;
      register.totals.discount += inv.discount_amount;
      register.totals.taxable += inv.taxable_amount;
      register.totals.tax += inv.total_tax;
      register.totals.total += inv.grand_total;
    }

    res.json(register);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/reports/purchase-register — purchase invoices register
router.get('/purchase-register', authorize('admin', 'accountant', 'manager'), async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('type', 'purchase')
      .gte('invoice_date', fromDate)
      .lte('invoice_date', toDate)
      .order('invoice_date');

    if (error) throw error;

    const register = {
      from: fromDate,
      to: toDate,
      invoices: invoices || [],
      totals: {
        count: invoices ? invoices.length : 0,
        subtotal: 0,
        discount: 0,
        taxable: 0,
        tax: 0,
        total: 0
      }
    };

    for (const inv of register.invoices) {
      register.totals.subtotal += inv.subtotal;
      register.totals.discount += inv.discount_amount;
      register.totals.taxable += inv.taxable_amount;
      register.totals.tax += inv.total_tax;
      register.totals.total += inv.grand_total;
    }

    res.json(register);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/reports/low-stock — low stock alert report
router.get('/low-stock', authorize('admin', 'accountant', 'manager'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, unit, current_stock, reorder_qty, purchase_rate')
      .eq('active', true)
      .lte('current_stock', 'reorder_qty')
      .order('current_stock');

    if (error) throw error;

    const report = {
      timestamp: new Date().toISOString(),
      total_alerts: data ? data.length : 0,
      products: (data || []).map(p => ({
        ...p,
        reorder_value: p.reorder_qty * p.purchase_rate,
        shortage: Math.max(0, p.reorder_qty - p.current_stock)
      }))
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
