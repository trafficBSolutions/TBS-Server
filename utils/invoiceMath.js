// utils/invoiceMath.js
function interestStepsSince(sentAt, now = new Date()) {
  if (!sentAt) return 0;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const days = Math.floor((now - new Date(sentAt)) / MS_PER_DAY);
  if (days <= 21) return 0;
  return 1 + Math.floor((days - 21) / 14);
}

function currentTotal(invoice, now = new Date()) {
  const steps = interestStepsSince(invoice.sentAt, now);
  const interest = invoice.principal * invoice.interestRate * steps;
  const total = invoice.principal + interest;
  // ensure cents rounding
  return Math.round(total * 100) / 100;
}

module.exports = { interestStepsSince, currentTotal };
