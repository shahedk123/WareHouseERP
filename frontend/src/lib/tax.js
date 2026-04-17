// Tax calculation library (mirrors backend taxService.js)

export const TAX_RATES = {
  GST: [0, 5, 12, 18, 28],
  VAT: [0, 5],
};

export const isInterstate = (partyStateCode, companyStateCode) => {
  return partyStateCode !== companyStateCode;
};

export const calcLineItem = (quantity, rate, taxRate = 5, taxType = 'GST', discountPct = 0, isInterstateTransaction = false) => {
  const subtotal = quantity * rate;
  const discountAmount = Math.round((subtotal * discountPct) / 100);
  const taxableAmount = subtotal - discountAmount;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let vatAmount = 0;

  if (taxType === 'GST') {
    if (isInterstateTransaction) {
      // Interstate: IGST = full rate
      igstAmount = Math.round((taxableAmount * taxRate) / 100);
    } else {
      // Intrastate: CGST + SGST = half rate each
      const halfRate = taxRate / 2;
      cgstAmount = Math.round((taxableAmount * halfRate) / 100);
      sgstAmount = Math.round((taxableAmount * halfRate) / 100);
    }
  } else if (taxType === 'VAT') {
    vatAmount = Math.round((taxableAmount * taxRate) / 100);
  }

  const totalTax = cgstAmount + sgstAmount + igstAmount + vatAmount;
  const grandTotal = taxableAmount + totalTax;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    vatAmount,
    totalTax,
    grandTotal,
  };
};

export const calcInvoiceTotals = (items) => {
  const totals = {
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    vat: 0,
    totalTax: 0,
    grandTotal: 0,
  };

  items.forEach((item) => {
    totals.subtotal += item.subtotal || 0;
    totals.discountAmount += item.discountAmount || 0;
    totals.taxableAmount += item.taxableAmount || 0;
    totals.cgst += item.cgstAmount || 0;
    totals.sgst += item.sgstAmount || 0;
    totals.igst += item.igstAmount || 0;
    totals.vat += item.vatAmount || 0;
    totals.totalTax += item.totalTax || 0;
    totals.grandTotal += item.grandTotal || 0;
  });

  return totals;
};
