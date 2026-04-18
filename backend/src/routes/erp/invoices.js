const express = require('express');
const multer  = require('multer');
const { createClient } = require('@supabase/supabase-js');
const invoiceService = require('../../services/invoiceService');
const pdfService = require('../../services/pdfService');
const { authorize } = require('../../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

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

// GET /api/erp/invoices/:id/pdf?template=modern&primaryColor=%231a56db
router.get('/:id/pdf', async (req, res) => {
  try {
    const { template, primaryColor, currency, footerText } = req.query;
    const doc = await pdfService.generateInvoicePDF(req.params.id, {
      template,
      primaryColor: primaryColor ? decodeURIComponent(primaryColor) : undefined,
      currency,
      footerText,
    });

    // Fetch invoice number for a nicer filename
    const { data: inv } = await supabase
      .from('invoices').select('invoice_number').eq('id', req.params.id).single();
    const filename = `invoice-${inv?.invoice_number || req.params.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp/invoices/template/analyze
// Upload a reference bill image → Gemini Vision extracts suggested template settings
router.post('/template/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `Analyze this invoice/bill image and extract the following details.
Return ONLY valid JSON, no markdown, no explanation:
{
  "company_name": "company name visible in the header",
  "primary_color": "dominant header/accent color as hex code (e.g. #1a56db). If black/white use #1F2937",
  "layout_style": "one of: modern, classic, vat, thermal",
  "has_arabic": true or false,
  "has_logo": true or false,
  "has_qr": true or false,
  "footer_text": "footer text if visible, else empty string",
  "column_count": number of columns in the items table,
  "notes": "brief description of the layout style in 1 sentence"
}`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();

    // Strip markdown code blocks if present
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const analysis = JSON.parse(clean);

    // Map layout_style to our template names
    const templateMap = { modern: 'modern', classic: 'classic', vat: 'vat', thermal: 'thermal' };
    analysis.suggested_template = templateMap[analysis.layout_style] || 'modern';

    res.json({ ok: true, analysis });
  } catch (err) {
    console.error('Bill analysis error:', err.message);
    // Return a safe fallback if AI fails
    res.json({
      ok: false,
      error: err.message,
      analysis: {
        primary_color: '#1a56db',
        suggested_template: 'modern',
        notes: 'Could not analyze the image. Using default settings.',
      },
    });
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
