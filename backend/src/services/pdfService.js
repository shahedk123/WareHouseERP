/**
 * pdfService.js — Invoice PDF generation with multiple templates
 *
 * Templates:
 *   classic  — Clean black-and-white, professional
 *   modern   — Colored header bar, clean layout
 *   vat      — Bilingual EN/AR, ZATCA-style VAT invoice with QR placeholder
 *   thermal  — Compact 80mm width for thermal POS printers
 */

const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toFixed(2);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens  = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const cvt = (n) => {
    if (n === 0) return '';
    if (n < 10)   return ones[n];
    if (n < 20)   return teens[n - 10];
    if (n < 100)  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + cvt(n % 100) : '');
    if (n < 1e5)  return cvt(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + cvt(n % 1000) : '');
    if (n < 1e7)  return cvt(Math.floor(n / 1e5)) + ' Lakh' + (n % 1e5 ? ' ' + cvt(n % 1e5) : '');
    return cvt(Math.floor(n / 1e7)) + ' Crore' + (n % 1e7 ? ' ' + cvt(n % 1e7) : '');
  };

  const whole = Math.floor(amount);
  const fils  = Math.round((amount - whole) * 100);
  const currency = 'SAR';
  let words = cvt(whole) + ` ${currency}`;
  if (fils > 0) words += ' and ' + cvt(fils) + ' Halalas';
  return words + ' Only';
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── data fetch ────────────────────────────────────────────────────────────────
async function fetchInvoiceData(invoiceId) {
  const [invRes, settingsRes] = await Promise.all([
    supabase.from('invoices').select('*, invoice_items(*)').eq('id', invoiceId).single(),
    supabase.from('company_settings').select('*').limit(1).single(),
  ]);

  if (invRes.error) throw new Error('Invoice not found: ' + invoiceId);

  const invoice = invRes.data;
  const company = settingsRes.data || {};
  const items   = invoice.invoice_items || [];

  return { invoice, company, items };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: CLASSIC (black & white, professional)
// ─────────────────────────────────────────────────────────────────────────────
function buildClassic(doc, invoice, company, items, opts = {}) {
  const L = 40, R = 555, W = R - L;
  const currency = opts.currency || company.currency || 'SAR';

  // ── Header ──
  doc.fontSize(22).font('Helvetica-Bold')
     .fillColor('#111111')
     .text(company.company_name || 'INVOICE', L, 45);

  if (company.address) {
    doc.fontSize(9).font('Helvetica').fillColor('#555')
       .text(company.address, L, 72, { width: 260 });
  }
  if (company.phone)  doc.text(`Tel: ${company.phone}`);
  if (company.trn)    doc.text(`TRN / VAT No: ${company.trn}`);
  if (company.gstin)  doc.text(`GSTIN: ${company.gstin}`);

  // Invoice title box (top right)
  doc.rect(350, 40, 205, 50).fillAndStroke('#111111', '#111111');
  doc.fontSize(20).font('Helvetica-Bold').fillColor('white')
     .text(invoice.type === 'purchase' ? 'PURCHASE INVOICE' : 'TAX INVOICE', 355, 53, { width: 195, align: 'center' });

  // Invoice meta
  doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold');
  doc.text(`Invoice No:`, 350, 100);
  doc.text(`Date:`,       350, 114);
  doc.text(`Due Date:`,   350, 128);

  doc.font('Helvetica').fillColor('#333');
  doc.text(invoice.invoice_number || '-', 420, 100);
  doc.text(fmtDate(invoice.invoice_date || invoice.date), 420, 114);
  doc.text(invoice.due_date ? fmtDate(invoice.due_date) : '-', 420, 128);

  // Divider
  doc.moveTo(L, 155).lineTo(R, 155).lineWidth(1).stroke('#CCCCCC');

  // ── Bill To ──
  const billY = 165;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#888').text('BILL TO', L, billY);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111111')
     .text(invoice.party_name || '-', L, billY + 14);
  doc.fontSize(9).font('Helvetica').fillColor('#555');
  if (invoice.party_address) doc.text(invoice.party_address, L, doc.y, { width: 250 });
  if (invoice.party_gstin)   doc.text(`VAT/TRN: ${invoice.party_gstin}`);

  // ── Items Table ──
  const tY = 230;
  const cols = { no: L, desc: 65, hsn: 260, qty: 330, unit: 370, rate: 420, total: 490 };

  // Header row
  doc.rect(L, tY, W, 18).fill('#222222');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
  doc.text('#',       cols.no,   tY + 5);
  doc.text('Description', cols.desc, tY + 5, { width: 185 });
  doc.text('HSN',    cols.hsn,  tY + 5);
  doc.text('Qty',    cols.qty,  tY + 5);
  doc.text('Unit',   cols.unit, tY + 5);
  doc.text('Rate',   cols.rate, tY + 5);
  doc.text('Amount', cols.total, tY + 5);

  let y = tY + 22;
  doc.fontSize(8.5).font('Helvetica').fillColor('#111111');

  items.forEach((item, i) => {
    if (y > 680) { doc.addPage(); y = 50; }
    const rowH = Math.max(15, Math.ceil(item.product_name.length / 25) * 12 + 6);
    if (i % 2 === 1) doc.rect(L, y - 2, W, rowH + 2).fill('#F8F8F8');
    doc.fillColor('#111111');
    doc.text(String(i + 1), cols.no, y, { width: 18 });
    doc.text(item.product_name || '-', cols.desc, y, { width: 190 });
    doc.text(item.hsn_code || '-', cols.hsn, y, { width: 60 });
    doc.text(String(item.quantity), cols.qty, y, { width: 35 });
    doc.text(item.unit || 'pcs', cols.unit, y, { width: 45 });
    doc.text(fmt(item.rate), cols.rate, y, { width: 65, align: 'right' });
    doc.text(fmt(item.line_total), cols.total, y, { width: 65, align: 'right' });
    y += rowH + 4;
  });

  // Totals block
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke('#CCCCCC');
  y += 8;

  const addTotalRow = (label, value, bold = false) => {
    if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
    doc.fontSize(9).fillColor('#333').text(label, 330, y, { width: 155, align: 'right' });
    doc.fillColor('#111111').text(value, cols.total, y, { width: 65, align: 'right' });
    y += 14;
  };

  addTotalRow('Subtotal:', `${currency} ${fmt(invoice.subtotal)}`);
  if (invoice.discount_amount > 0) addTotalRow('Discount:', `- ${currency} ${fmt(invoice.discount_amount)}`);
  addTotalRow('Taxable Amount:', `${currency} ${fmt(invoice.taxable_amount)}`);
  if (invoice.vat_amount > 0)  addTotalRow(`VAT (${fmt(invoice.vat_amount / invoice.taxable_amount * 100)}%):`, `${currency} ${fmt(invoice.vat_amount)}`);
  if (invoice.cgst_amount > 0) addTotalRow('CGST:', `${currency} ${fmt(invoice.cgst_amount)}`);
  if (invoice.sgst_amount > 0) addTotalRow('SGST:', `${currency} ${fmt(invoice.sgst_amount)}`);
  if (invoice.igst_amount > 0) addTotalRow('IGST:', `${currency} ${fmt(invoice.igst_amount)}`);

  doc.moveTo(330, y).lineTo(R, y).lineWidth(0.5).stroke('#111111');
  y += 4;
  addTotalRow('GRAND TOTAL:', `${currency} ${fmt(invoice.grand_total)}`, true);

  // Amount in words
  y += 6;
  doc.rect(L, y, W, 22).fill('#F3F4F6');
  doc.fontSize(8.5).font('Helvetica').fillColor('#555')
     .text(`Amount in words: ${amountInWords(invoice.grand_total)}`, L + 8, y + 7, { width: W - 16 });
  y += 30;

  // Footer
  doc.fontSize(8).font('Helvetica').fillColor('#888');
  doc.text(opts.footerText || company.footer_text || 'Thank you for your business.', L, y, { width: W / 2 });
  doc.text('Authorized Signature: ____________________', R - 180, y, { align: 'right' });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: MODERN (colored header)
// ─────────────────────────────────────────────────────────────────────────────
function buildModern(doc, invoice, company, items, opts = {}) {
  const L = 40, R = 555, W = R - L;
  const PRIMARY   = opts.primaryColor || '#1a56db';
  const DARK      = '#111827';
  const currency  = opts.currency || company.currency || 'SAR';
  const [pr, pg, pb] = hexToRgb(PRIMARY);

  // ── Header bar ──
  doc.rect(0, 0, 595, 90).fill(PRIMARY);

  doc.fontSize(22).font('Helvetica-Bold').fillColor('white')
     .text(company.company_name || 'Company', L, 20);
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.8)');
  if (company.address) doc.text(company.address, L, 46, { width: 280 });
  if (company.phone)   doc.text(`Tel: ${company.phone}`, L, doc.y);
  if (company.trn)     doc.text(`VAT/TRN: ${company.trn}`, L, doc.y);

  // Invoice tag top-right
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
     .text(invoice.type === 'purchase' ? 'PURCHASE INVOICE' : 'TAX INVOICE', 350, 22, { width: 205, align: 'right' });
  doc.fontSize(8.5).font('Helvetica').fillColor('rgba(255,255,255,0.85)')
     .text(`No: ${invoice.invoice_number || '-'}`, 350, 42, { width: 205, align: 'right' })
     .text(`Date: ${fmtDate(invoice.invoice_date || invoice.date)}`, 350, 55, { width: 205, align: 'right' });
  if (invoice.due_date) {
    doc.text(`Due: ${fmtDate(invoice.due_date)}`, 350, 68, { width: 205, align: 'right' });
  }

  // ── Bill To card ──
  doc.rect(L, 105, 240, 80).lineWidth(0.5).fillAndStroke('#F9FAFB', '#E5E7EB');
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PRIMARY).text('BILL TO', L + 10, 114);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK).text(invoice.party_name || '-', L + 10, 126, { width: 220 });
  doc.fontSize(8.5).font('Helvetica').fillColor('#6B7280');
  if (invoice.party_address) doc.text(invoice.party_address, L + 10, doc.y, { width: 220 });
  if (invoice.party_gstin)   doc.text(`VAT/TRN: ${invoice.party_gstin}`, L + 10, doc.y);

  // Status badge
  const statusColors = { draft: '#FEF3C7', confirmed: '#DBEAFE', paid: '#DCFCE7', cancelled: '#FEE2E2' };
  const statusText   = { draft: '#92400E', confirmed: '#1E40AF', paid: '#166534', cancelled: '#991B1B' };
  const status = invoice.status || 'draft';
  doc.rect(330, 110, 220, 30).fillAndStroke(statusColors[status] || '#F3F4F6', 'transparent');
  doc.fontSize(11).font('Helvetica-Bold').fillColor(statusText[status] || '#374151')
     .text(status.toUpperCase(), 330, 119, { width: 220, align: 'center' });

  // ── Items table ──
  const tY = 200;
  const cols = { no: L, desc: 64, hsn: 255, qty: 320, unit: 358, rate: 405, total: 475 };

  doc.rect(L, tY, W, 20).fill(PRIMARY);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
  ['#', 'DESCRIPTION', 'HSN', 'QTY', 'UNIT', 'RATE', 'AMOUNT'].forEach((h, i) => {
    const x = [cols.no, cols.desc, cols.hsn, cols.qty, cols.unit, cols.rate, cols.total][i];
    doc.text(h, x, tY + 6, { width: 55 });
  });

  let y = tY + 24;
  doc.fontSize(8.5).font('Helvetica').fillColor(DARK);

  items.forEach((item, i) => {
    if (y > 680) { doc.addPage(); y = 50; }
    const rowH = Math.max(16, Math.ceil((item.product_name || '').length / 28) * 12 + 6);
    if (i % 2 === 0) doc.rect(L, y - 2, W, rowH + 2).fill('#F9FAFB');
    doc.fillColor(DARK);
    doc.text(String(i + 1), cols.no, y, { width: 18 });
    doc.text(item.product_name || '-', cols.desc, y, { width: 186 });
    doc.text(item.hsn_code || '-', cols.hsn, y, { width: 58 });
    doc.text(String(item.quantity), cols.qty, y, { width: 32, align: 'right' });
    doc.text(item.unit || 'pcs', cols.unit, y, { width: 42 });
    doc.text(fmt(item.rate), cols.rate, y, { width: 65, align: 'right' });
    doc.text(fmt(item.line_total), cols.total, y, { width: 75, align: 'right' });
    y += rowH + 4;
  });

  // Totals
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke('#E5E7EB');
  y += 10;

  const addRow = (label, val, highlight = false) => {
    if (highlight) {
      doc.rect(330, y - 3, W - 290, 18).fill(PRIMARY);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('white');
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#6B7280');
    }
    doc.text(label, 330, y, { width: 140, align: 'right' });
    doc.fillColor(highlight ? 'white' : DARK).font(highlight ? 'Helvetica-Bold' : 'Helvetica')
       .text(val, cols.total, y, { width: 75, align: 'right' });
    y += 16;
  };

  addRow('Subtotal:', `${currency} ${fmt(invoice.subtotal)}`);
  if (invoice.discount_amount > 0) addRow('Discount:', `- ${currency} ${fmt(invoice.discount_amount)}`);
  addRow('Taxable:', `${currency} ${fmt(invoice.taxable_amount)}`);
  if (invoice.vat_amount > 0)  addRow(`VAT:`, `${currency} ${fmt(invoice.vat_amount)}`);
  if (invoice.cgst_amount > 0) addRow('CGST:', `${currency} ${fmt(invoice.cgst_amount)}`);
  if (invoice.sgst_amount > 0) addRow('SGST:', `${currency} ${fmt(invoice.sgst_amount)}`);
  y += 2;
  addRow('GRAND TOTAL', `${currency} ${fmt(invoice.grand_total)}`, true);

  // Amount in words
  y += 10;
  doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF')
     .text(`In Words: ${amountInWords(invoice.grand_total)}`, L, y, { width: W });

  // Footer band
  doc.rect(0, 770, 595, 28).fill(PRIMARY);
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.85)')
     .text(opts.footerText || company.footer_text || 'Thank you for your business.', L, 778, { width: W / 2 });
  doc.text('Authorized Signature: _________________', 350, 778, { width: 205, align: 'right' });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: VAT (bilingual EN/AR, ZATCA-style)
// ─────────────────────────────────────────────────────────────────────────────
function buildVAT(doc, invoice, company, items, opts = {}) {
  const L = 40, R = 555, W = R - L;
  const PRIMARY  = opts.primaryColor || '#0f172a';
  const currency = opts.currency || company.currency || 'SAR';

  // ── Bilingual header ──
  doc.rect(0, 0, 595, 100).fill(PRIMARY);

  // EN left
  doc.fontSize(18).font('Helvetica-Bold').fillColor('white')
     .text(company.company_name || 'Company', L, 18);
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.75)');
  if (company.address) doc.text(company.address, L, 42, { width: 260 });
  if (company.phone)   doc.text(`Tel: ${company.phone}`, L, doc.y);
  if (company.trn)     doc.text(`VAT No: ${company.trn}`, L, doc.y);

  // AR right (right-aligned, simulated with RTL text note)
  doc.fontSize(14).font('Helvetica-Bold').fillColor('white')
     .text('فاتورة ضريبية', 295, 20, { width: 260, align: 'right' });
  doc.fontSize(8).font('Helvetica').fillColor('rgba(255,255,255,0.75)')
     .text(`رقم الفاتورة: ${invoice.invoice_number || '-'}`, 295, 42, { width: 260, align: 'right' })
     .text(`التاريخ: ${fmtDate(invoice.invoice_date || invoice.date)}`, 295, 54, { width: 260, align: 'right' });
  if (company.trn) {
    doc.text(`رقم ضريبة القيمة المضافة: ${company.trn}`, 295, 66, { width: 260, align: 'right' });
  }

  // ── Invoice/Party info ──
  const infoY = 112;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280').text('SELLER / البائع', L, infoY);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827').text(company.company_name || '-', L, infoY + 14);
  doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
  if (company.address) doc.text(company.address, L, doc.y, { width: 240 });
  if (company.trn)     doc.text(`TRN: ${company.trn}`, L, doc.y);

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280').text('BUYER / المشتري', 310, infoY);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827').text(invoice.party_name || '-', 310, infoY + 14);
  doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
  if (invoice.party_address) doc.text(invoice.party_address, 310, doc.y, { width: 240 });
  if (invoice.party_gstin)   doc.text(`TRN: ${invoice.party_gstin}`, 310, doc.y);

  // ── Items table ──
  const tY = 198;
  doc.rect(L, tY, W, 20).fill('#1e293b');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
  const cols = { no: 42, desc: 62, hsn: 245, qty: 310, unit: 350, rate: 400, vat: 450, total: 500 };
  [['#',2],['Description / الوصف',183],['HSN',60],['Qty',35],['Unit',45],['Rate',45],['VAT',45],['Total',60]].forEach(([h, w], i) => {
    const x = [cols.no, cols.desc, cols.hsn, cols.qty, cols.unit, cols.rate, cols.vat, cols.total][i];
    doc.text(h, x, tY + 6, { width: w });
  });

  let y = tY + 24;
  let totalVat = 0;

  doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
  items.forEach((item, i) => {
    if (y > 670) { doc.addPage(); y = 50; }
    const rowH = Math.max(14, Math.ceil((item.product_name || '').length / 30) * 12 + 4);
    if (i % 2 === 0) doc.rect(L, y - 2, W, rowH + 2).fill('#F8FAFC');
    doc.fillColor('#111827');
    const vatAmt = item.vat_amount || item.tax_amount || 0;
    totalVat += vatAmt;
    doc.text(String(i + 1), cols.no, y, { width: 14 });
    doc.text(item.product_name || '-', cols.desc, y, { width: 176 });
    doc.text(item.hsn_code || '-', cols.hsn, y, { width: 58 });
    doc.text(String(item.quantity), cols.qty, y, { width: 33, align: 'right' });
    doc.text(item.unit || 'pcs', cols.unit, y, { width: 44 });
    doc.text(fmt(item.rate), cols.rate, y, { width: 44, align: 'right' });
    doc.text(fmt(vatAmt), cols.vat, y, { width: 44, align: 'right' });
    doc.text(fmt(item.line_total), cols.total, y, { width: 55, align: 'right' });
    y += rowH + 4;
  });

  // Totals
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke('#CBD5E1');
  y += 8;

  const rowPair = (en, ar, val) => {
    doc.fontSize(8.5).font('Helvetica').fillColor('#64748B')
       .text(`${en} / ${ar}`, 260, y, { width: 200, align: 'right' });
    doc.fillColor('#111827').text(val, cols.total, y, { width: 55, align: 'right' });
    y += 14;
  };

  rowPair('Subtotal', 'المجموع', `${currency} ${fmt(invoice.subtotal)}`);
  if (invoice.discount_amount > 0) rowPair('Discount', 'خصم', `- ${currency} ${fmt(invoice.discount_amount)}`);
  rowPair('Taxable', 'الوعاء الضريبي', `${currency} ${fmt(invoice.taxable_amount)}`);
  rowPair(`VAT ${invoice.vat_amount > 0 ? fmt(invoice.vat_amount / Math.max(invoice.taxable_amount, 1) * 100) + '%' : ''}`, 'ضريبة القيمة المضافة', `${currency} ${fmt(invoice.vat_amount || totalVat)}`);

  doc.rect(260, y - 3, W - 220, 22).fill('#0f172a');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('white')
     .text(`TOTAL / الإجمالي`, 264, y + 3, { width: 190, align: 'right' });
  doc.text(`${currency} ${fmt(invoice.grand_total)}`, cols.total, y + 3, { width: 55, align: 'right' });
  y += 28;

  // QR placeholder
  doc.rect(L, y, 80, 80).lineWidth(1).stroke('#CBD5E1');
  doc.fontSize(7).font('Helvetica').fillColor('#94A3B8')
     .text('QR Code\n(ZATCA)', L + 10, y + 30, { width: 60, align: 'center' });

  // Amount in words (bilingual)
  doc.fontSize(8).font('Helvetica').fillColor('#64748B')
     .text(`Amount in Words: ${amountInWords(invoice.grand_total)}`, L + 90, y + 5, { width: W - 90 });

  // Footer
  y += 90;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke('#E2E8F0');
  doc.fontSize(7.5).font('Helvetica').fillColor('#94A3B8')
     .text(opts.footerText || 'This is a computer-generated invoice / هذه فاتورة مُنشأة إلكترونياً', L, y + 8, { width: W, align: 'center' });
  doc.text(`Generated: ${new Date().toISOString()}`, L, y + 20, { width: W, align: 'center' });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE: THERMAL (80mm / 226pt width, compact)
// ─────────────────────────────────────────────────────────────────────────────
function buildThermal(doc, invoice, company, items, opts = {}) {
  const W = 186; // 226pt - margins
  const L = 20, R = L + W;
  const currency = opts.currency || company.currency || 'SAR';

  const center = (text, y, size = 9, bold = false) => {
    doc.fontSize(size).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111')
       .text(text, L, y, { width: W, align: 'center' });
  };

  const line = (y) => doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).stroke('#333').moveDown(0);

  center(company.company_name || 'RECEIPT', 20, 13, true);
  let y = doc.y + 2;
  center(company.address || '', y, 8);
  y = doc.y + 1;
  if (company.phone) { center(`Tel: ${company.phone}`, y, 8); y = doc.y + 1; }
  if (company.trn)   { center(`VAT: ${company.trn}`, y, 8);   y = doc.y + 1; }

  line(y + 4); y += 10;

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#111')
     .text(`TAX INVOICE`, L, y, { width: W, align: 'center' });
  y = doc.y + 2;
  doc.fontSize(7.5).font('Helvetica')
     .text(`No: ${invoice.invoice_number || '-'}  Date: ${fmtDate(invoice.invoice_date || invoice.date)}`, L, y, { width: W, align: 'center' });
  y = doc.y + 2;
  doc.text(`Customer: ${invoice.party_name || '-'}`, L, y, { width: W });
  y = doc.y + 2;

  line(y + 2); y += 8;

  // Column headers
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#111');
  doc.text('Item', L, y, { width: 90 });
  doc.text('Qty', L + 90, y, { width: 30, align: 'right' });
  doc.text('Rate', L + 120, y, { width: 35, align: 'right' });
  doc.text('Total', L + 152, y, { width: 34, align: 'right' });
  y += 12;

  line(y - 2); y += 4;

  doc.fontSize(7.5).font('Helvetica').fillColor('#111');
  items.forEach((item) => {
    if (y > 750) { doc.addPage({ size: [226, 900] }); y = 20; }
    const name = (item.product_name || '-').substring(0, 22);
    doc.text(name, L, y, { width: 88 });
    doc.text(String(item.quantity), L + 90, y, { width: 30, align: 'right' });
    doc.text(fmt(item.rate), L + 120, y, { width: 35, align: 'right' });
    doc.text(fmt(item.line_total), L + 152, y, { width: 34, align: 'right' });
    y += 12;
  });

  line(y + 2); y += 6;

  const totalRow = (label, val, bold = false) => {
    doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111');
    doc.text(label, L, y, { width: 120 });
    doc.text(val, L + 120, y, { width: 66, align: 'right' });
    y += 12;
  };

  totalRow('Subtotal:', `${currency} ${fmt(invoice.subtotal)}`);
  if (invoice.discount_amount > 0) totalRow('Discount:', `- ${currency} ${fmt(invoice.discount_amount)}`);
  if (invoice.vat_amount > 0) totalRow(`VAT:`, `${currency} ${fmt(invoice.vat_amount)}`);
  if (invoice.cgst_amount > 0) totalRow('CGST+SGST:', `${currency} ${fmt((invoice.cgst_amount || 0) + (invoice.sgst_amount || 0))}`);

  line(y + 2); y += 6;
  totalRow('TOTAL:', `${currency} ${fmt(invoice.grand_total)}`, true);

  y += 6;
  center(opts.footerText || 'Thank you!', y, 8);
  y = doc.y + 4;
  center(`*** ${new Date().toLocaleDateString()} ***`, y, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
async function generateInvoicePDF(invoiceId, options = {}) {
  const { invoice, company, items } = await fetchInvoiceData(invoiceId);

  const template = options.template || company.invoice_template || 'modern';
  const opts = {
    primaryColor: options.primaryColor || company.primary_color || '#1a56db',
    currency:     options.currency     || company.currency       || 'SAR',
    footerText:   options.footerText   || company.footer_text    || 'Thank you for your business.',
  };

  let docOpts = { size: 'A4', margin: 40 };
  if (template === 'thermal') {
    docOpts = { size: [226, 900], margins: { top: 10, bottom: 10, left: 20, right: 20 } };
  }

  const doc = new PDFDocument(docOpts);

  switch (template) {
    case 'classic': buildClassic(doc, invoice, company, items, opts); break;
    case 'vat':     buildVAT(doc, invoice, company, items, opts);     break;
    case 'thermal': buildThermal(doc, invoice, company, items, opts); break;
    default:        buildModern(doc, invoice, company, items, opts);  break;
  }

  return doc;
}

module.exports = { generateInvoicePDF, amountInWords };
