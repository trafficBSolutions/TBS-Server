// utils/pricing.js
exports.computeTotalFromSelections = (priceList, sel) => {
  const byCode = new Map(priceList.items.map(i => [i.code, i]));
  const pick = code => byCode.get(code)?.priceCents || 0;

  let sum = 0;

  // Example selection contract. Adjust to your UI:
  // sel = { flagDay: 'HALF'|'FULL'|'EMERG', laneClosure: 'NONE'|'HALF'|'FULL',
  //         intersections: 3, arrowBoard: true, afterHours: true, extraMiles: 10 }

  if (sel.flagDay === 'HALF') sum += pick('FLAG_HALF');
  if (sel.flagDay === 'FULL') sum += pick('FLAG_FULL');
  if (sel.flagDay === 'EMERG') sum += pick('FLAG_EMERG');

  if (sel.laneClosure === 'HALF') sum += pick('LC_HALF');
  if (sel.laneClosure === 'FULL') sum += pick('LC_FULL');

  if (sel.intersections) sum += sel.intersections * pick('INT_SIGN');
  if (sel.arrowBoard) sum += pick('ARROW');
  if (sel.afterHours) sum += pick('AFTER_HRS');

  const free = priceList.mileage?.freeMiles ?? 0;
  const rate = priceList.mileage?.rateCentsPerMile ?? 0;
  const billableMiles = Math.max(0, (sel.extraMiles ?? 0) - free);
  sum += billableMiles * rate;

  return sum;
};
