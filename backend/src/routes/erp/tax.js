const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authorize } = require('../../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/erp/tax/gst-summary — GST summary by month
router.get('/gst-summary', authorize('admin', 'accountant', 'manager'), async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    // Get all invoices in date range
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .gte('invoice_date', fromDate)
      .lte('invoice_date', toDate)
      .in('status', ['confirmed', 'paid']);

    if (error) throw error;

    // Group by type and aggregate tax
    const summary = {
      from: fromDate,
      to: toDate,
      sale: {
        total_taxable: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        invoices: 0
      },
      purchase: {
        total_taxable: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_igst: 0,
        invoices: 0
      }
    };

    for (const inv of invoices || []) {
      const key = inv.type === 'sale' ? 'sale' : 'purchase';
      summary[key].total_taxable += inv.taxable_amount;
      summary[key].total_cgst += inv.cgst_amount;
      summary[key].total_sgst += inv.sgst_amount;
      summary[key].total_igst += inv.igst_amount;
      summary[key].invoices += 1;
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/tax/vat-summary — VAT summary
router.get('/vat-summary', authorize('admin', 'accountant', 'manager'), async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .gte('invoice_date', fromDate)
      .lte('invoice_date', toDate)
      .in('status', ['confirmed', 'paid']);

    if (error) throw error;

    const summary = {
      from: fromDate,
      to: toDate,
      total_taxable: 0,
      total_vat: 0,
      invoices: 0
    };

    for (const inv of invoices || []) {
      summary.total_taxable += inv.taxable_amount;
      summary.total_vat += inv.vat_amount;
      summary.invoices += 1;
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/tax/gstr1 — GSTR-1 report (sales for GST return)
router.get('/gstr1', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { from, to } = req.query;

    const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];

    // Get all sale invoices
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), party_id(gstin)')
      .eq('type', 'sale')
      .gte('invoice_date', fromDate)
      .lte('invoice_date', toDate)
      .in('status', ['confirmed', 'paid']);

    if (error) throw error;

    // Format for GSTR-1
    const gstr1 = {
      from: fromDate,
      to: toDate,
      b2b: [], // B2B invoices (with GSTIN)
      b2c: [], // B2C invoices (without GSTIN)
      export: [],
      amendments: []
    };

    for (const inv of invoices || []) {
      const invoice = {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        party_name: inv.party_name,
        party_gstin: inv.party_gstin,
        taxable_amount: inv.taxable_amount,
        cgst: inv.cgst_amount,
        sgst: inv.sgst_amount,
        igst: inv.igst_amount,
        cess: 0,
        invoice_type: inv.is_interstate ? 'IGST' : 'CGST+SGST',
        items: (inv.invoice_items || []).length
      };

      if (inv.party_gstin) {
        gstr1.b2b.push(invoice);
      } else {
        gstr1.b2c.push(invoice);
      }
    }

    res.json(gstr1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
