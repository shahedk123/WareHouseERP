const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const num = Math.floor(amount);
  const paise = Math.round((amount - num) * 100);
  let words = convert(num) + ' Rupees';
  if (paise > 0) words += ' ' + convert(paise) + ' Paise';
  return words + ' Only';
}

async function generateInvoicePDF(invoiceId) {
  try {
    // Fetch invoice with items
    const invRes = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .single();

    if (invRes.error) throw new Error('Invoice not found');
    const invoice = invRes.data;

    // Fetch company settings
    const settingsRes = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    const company = settingsRes.data || {};

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // Helper to add two-column sections
    const addTwoColumn = (left, right, fontSize = 10) => {
      doc.fontSize(fontSize);
      doc.text(left, { width: 250 }).moveUp();
      doc.text(right, 280, undefined, { width: 250 });
      doc.moveDown();
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(company.company_name || 'Invoice', { underline: true });
    doc.fontSize(12).font('Helvetica').text(company.address || '');
    if (company.phone) doc.text(`Phone: ${company.phone}`);
    if (company.gstin) doc.text(`GSTIN: ${company.gstin}`);
    doc.moveDown();

    // Invoice details
    addTwoColumn(
      `Invoice #: ${invoice.invoice_number}`,
      `Date: ${invoice.invoice_date}`
    );
    addTwoColumn(
      `Type: ${invoice.type.toUpperCase()}`,
      `Status: ${invoice.status.toUpperCase()}`
    );
    if (invoice.due_date) {
      addTwoColumn(`Due Date: ${invoice.due_date}`, '');
    }
    doc.moveDown();

    // Bill to
    doc.fontSize(11).font('Helvetica-Bold').text('BILL TO:');
    doc.fontSize(10).font('Helvetica');
    doc.text(invoice.party_name);
    if (invoice.party_address) doc.text(invoice.party_address);
    if (invoice.party_gstin) doc.text(`GSTIN: ${invoice.party_gstin}`);
    doc.moveDown();

    // Items table header
    const tableTop = doc.y;
    const col1 = 40, col2 = 80, col3 = 180, col4 = 280, col5 = 350, col6 = 420, col7 = 500;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('#', col1, tableTop);
    doc.text('Description', col2, tableTop);
    doc.text('HSN', col3, tableTop);
    doc.text('Qty', col4, tableTop);
    doc.text('Unit', col5, tableTop);
    doc.text('Rate', col6, tableTop);
    doc.text('Amount', col7, tableTop);

    // Draw line
    doc.moveTo(col1, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 20;
    doc.font('Helvetica').fontSize(9);

    // Items
    for (let i = 0; i < (invoice.invoice_items || []).length; i++) {
      const item = invoice.invoice_items[i];
      doc.text(String(i + 1), col1, y);
      doc.text(item.product_name, col2, y, { width: 95 });
      doc.text(item.hsn_code || '-', col3, y);
      doc.text(String(item.quantity), col4, y);
      doc.text(item.unit, col5, y);
      doc.text(String(item.rate.toFixed(2)), col6, y);
      doc.text(String(item.line_total.toFixed(2)), col7, y);
      y += 15;
    }

    // Draw totals line
    doc.moveTo(col1, y).lineTo(550, y).stroke();
    y += 10;

    // Totals
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('SUBTOTAL', col2, y);
    doc.text(String(invoice.subtotal.toFixed(2)), col7, y);
    y += 15;

    if (invoice.discount_amount > 0) {
      doc.text('DISCOUNT', col2, y);
      doc.text(String(invoice.discount_amount.toFixed(2)), col7, y);
      y += 15;
    }

    doc.text('TAXABLE AMOUNT', col2, y);
    doc.text(String(invoice.taxable_amount.toFixed(2)), col7, y);
    y += 15;

    // Tax lines
    if (invoice.cgst_amount > 0) {
      doc.text(`CGST (${(invoice.cgst_amount / invoice.taxable_amount * 100).toFixed(1)}%)`, col2, y);
      doc.text(String(invoice.cgst_amount.toFixed(2)), col7, y);
      y += 15;
    }

    if (invoice.sgst_amount > 0) {
      doc.text(`SGST (${(invoice.sgst_amount / invoice.taxable_amount * 100).toFixed(1)}%)`, col2, y);
      doc.text(String(invoice.sgst_amount.toFixed(2)), col7, y);
      y += 15;
    }

    if (invoice.igst_amount > 0) {
      doc.text(`IGST (${(invoice.igst_amount / invoice.taxable_amount * 100).toFixed(1)}%)`, col2, y);
      doc.text(String(invoice.igst_amount.toFixed(2)), col7, y);
      y += 15;
    }

    if (invoice.vat_amount > 0) {
      doc.text('VAT', col2, y);
      doc.text(String(invoice.vat_amount.toFixed(2)), col7, y);
      y += 15;
    }

    // Grand total
    doc.moveTo(col1, y).lineTo(550, y).stroke();
    y += 8;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('GRAND TOTAL', col2, y);
    doc.text(String(invoice.grand_total.toFixed(2)), col7, y);
    y += 20;

    // Amount in words
    doc.fontSize(9).font('Helvetica');
    doc.text(`Rupees: ${amountInWords(invoice.grand_total)}`);
    y += 15;

    // Footer
    doc.fontSize(9).moveTo(40, y).lineTo(550, y).stroke();
    y += 10;
    doc.text('Authorized Signature', 40, y);
    doc.text(`Generated on ${new Date().toISOString()}`, 350, y);

    return doc;

  } catch (err) {
    console.error('generateInvoicePDF error:', err.message);
    throw err;
  }
}

module.exports = {
  generateInvoicePDF,
  amountInWords
};
