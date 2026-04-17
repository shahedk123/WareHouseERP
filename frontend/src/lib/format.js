// Formatting utilities for display

export const fmtCurrency = (value) => {
  if (!value && value !== 0) return '₹0';
  return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const fmtPercent = (value) => {
  if (!value && value !== 0) return '0%';
  return value.toFixed(2) + '%';
};

export const fmtPhone = (phone) => {
  if (!phone) return '';
  // Assuming E.164 format: +919876543210
  const match = phone.match(/\+(\d{2})(\d{5})(\d{5})/);
  if (match) return `+${match[1]} ${match[2]} ${match[3]}`;
  return phone;
};

export const fmtGSTIN = (gstin) => {
  if (!gstin) return '';
  // GSTIN: 27AABCT1234H1Z0 -> format as is
  return gstin;
};

export const fmtStockStatus = (current, reorder) => {
  if (current === 0) return 'Out of Stock';
  if (current <= reorder) return 'Low Stock';
  return 'In Stock';
};

export const fmtInvoiceStatus = (status) => {
  const statuses = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    paid: 'Paid',
  };
  return statuses[status] || status;
};

export const amountInWords = (amount) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  const convertHundreds = (num) => {
    let words = '';
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;

    if (hundreds > 0) {
      words += ones[hundreds] + ' Hundred ';
    }

    if (remainder >= 10 && remainder < 20) {
      words += teens[remainder - 10];
    } else {
      const tenVal = Math.floor(remainder / 10);
      const oneVal = remainder % 10;
      if (tenVal > 0) words += tens[tenVal] + ' ';
      if (oneVal > 0) words += ones[oneVal];
    }

    return words.trim();
  };

  if (amount === 0) return 'Zero';

  let words = '';
  let scaleIndex = 0;

  while (amount > 0 && scaleIndex < scales.length) {
    const divisor = scaleIndex === 0 ? 100 : (scaleIndex === 1 ? 1000 : 100000);
    const chunk = amount % divisor;

    if (chunk > 0) {
      const chunkWords = convertHundreds(chunk);
      if (chunkWords) {
        words = chunkWords + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + (words ? ' ' + words : '');
      }
    }

    amount = Math.floor(amount / divisor);
    scaleIndex++;
  }

  return words.trim() + ' Rupees Only';
};
