// Tax calculation service — shared logic for GST (India) and VAT (GCC)
// Used by both backend (invoices) and frontend (UI calculations)

const GST_RATES = [0, 5, 12, 18, 28];
const VAT_RATES = [0, 5];

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Calculate single line item with tax
function calcLineItem({ qty, rate, discountPct = 0, taxRate = 18, isInterstate = false, taxRegime = 'GST' }) {
  const gross = round2(qty * rate);
  const discountAmt = round2(gross * (discountPct / 100));
  const taxable = round2(gross - discountAmt);

  let cgstRate = 0, sgstRate = 0, igstRate = 0, vatRate = 0;
  let cgstAmt = 0, sgstAmt = 0, igstAmt = 0, vatAmt = 0;

  if (taxRegime === 'VAT') {
    // VAT applies fully, no GST
    vatRate = taxRate;
    vatAmt = round2(taxable * (vatRate / 100));
  } else if (isInterstate) {
    // Interstate GST: full rate as IGST
    igstRate = taxRate;
    igstAmt = round2(taxable * (igstRate / 100));
  } else {
    // Intrastate GST: split into CGST + SGST
    cgstRate = taxRate / 2;
    sgstRate = taxRate / 2;
    cgstAmt = round2(taxable * (cgstRate / 100));
    sgstAmt = round2(taxable * (sgstRate / 100));
  }

  const totalTax = cgstAmt + sgstAmt + igstAmt + vatAmt;
  const lineTotal = taxable + totalTax;

  return {
    gross,
    discountPct,
    discountAmt,
    taxable,
    taxRate,
    cgstRate,
    cgstAmt,
    sgstRate,
    sgstAmt,
    igstRate,
    igstAmt,
    vatRate,
    vatAmt,
    totalTax,
    lineTotal
  };
}

// Calculate invoice totals across all line items
function calcInvoiceTotals(items) {
  const totals = {
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    vatAmount: 0,
    totalTax: 0,
    grandTotal: 0
  };

  for (const item of items) {
    totals.subtotal += item.gross || 0;
    totals.discountAmount += item.discountAmt || 0;
    totals.taxableAmount += item.taxable || 0;
    totals.cgstAmount += item.cgstAmt || 0;
    totals.sgstAmount += item.sgstAmt || 0;
    totals.igstAmount += item.igstAmt || 0;
    totals.vatAmount += item.vatAmt || 0;
    totals.totalTax += item.totalTax || 0;
    totals.lineTotal += item.lineTotal || 0;
  }

  totals.subtotal = round2(totals.subtotal);
  totals.discountAmount = round2(totals.discountAmount);
  totals.taxableAmount = round2(totals.taxableAmount);
  totals.cgstAmount = round2(totals.cgstAmount);
  totals.sgstAmount = round2(totals.sgstAmount);
  totals.igstAmount = round2(totals.igstAmount);
  totals.vatAmount = round2(totals.vatAmount);
  totals.totalTax = round2(totals.totalTax);
  totals.grandTotal = round2(totals.taxableAmount + totals.totalTax);

  return totals;
}

module.exports = {
  calcLineItem,
  calcInvoiceTotals,
  GST_RATES,
  VAT_RATES,
  round2
};
