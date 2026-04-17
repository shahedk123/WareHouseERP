const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const invoiceService = require('../../services/invoiceService');
const pdfService = require('../../services/pdfService');
const { authorize } = require('../../middleware/auth');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// GET /api/erp/invoices — list invoices
router.get('/', async (req, res) => {
  try {
    const { type, status, from, to, party_id } = req.query;

    let query = supabase.from('invoices').select('*');

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (party_id) {
      query = query.eq('party_id', party_id);
    }

    if (from) {
      query = query.gte('invoice_date', from);
    }

    if (to) {
      query = query.lte('invoice_date', to);
    }

    const { data, error } = await query.order('invoice_date', { ascending: false });
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/invoices/:id — get single invoice with items
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Invoice not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/invoices — create invoice
router.post('/', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { type, partyId, items, date, dueDate, notes, pendingBillId } = req.body;

    if (!type || !partyId || !items || items.length === 0) {
      return res.status(400).json({ error: 'type, partyId, and items required' });
    }

    const result = await invoiceService.createInvoice({
      type,
      partyId,
      items,
      date: date || new Date().toISOString().split('T')[0],
      dueDate,
      notes,
      userId: req.user.id,
      pendingBillId
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/erp/invoices/:id/confirm — confirm invoice (lock stock)
router.put('/:id/confirm', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const invoice = await invoiceService.confirmInvoice(req.params.id);
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/erp/invoices/:id/cancel — cancel invoice
router.put('/:id/cancel', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const result = await invoiceService.cancelInvoice(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/erp/invoices/:id/pdf — download invoice PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const doc = await pdfService.generateInvoicePDF(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);

    doc.pipe(res);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/invoices/:id/payment — record payment
router.post('/:id/payment', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'amount required' });
    }

    // Get invoice
    const invRes = await supabase
      .from('invoices')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (invRes.error) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invRes.data;

    // Record payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        invoice_id: req.params.id,
        party_id: invoice.party_id,
        amount,
        method: method || 'cash',
        reference,
        notes,
        created_by: req.user.id
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update invoice balance
    const newBalance = Math.max(0, invoice.balance_due - amount);
    const newStatus = newBalance === 0 ? 'paid' : invoice.status;

    const { data: updated } = await supabase
      .from('invoices')
      .update({
        paid_amount: (invoice.paid_amount || 0) + amount,
        balance_due: newBalance,
        status: newStatus
      })
      .eq('id', req.params.id)
      .select()
      .single();

    res.json({ payment, invoice: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
