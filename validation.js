// Best-effort check for street addresses in the location field. Not
// perfect (no pattern match can be), so this is a safety net alongside
// manual review, not a guarantee -- it flags common address shapes
// (house number + street word, PO boxes, zip codes) for the person to
// fix before submitting.
export function looksLikeAddress(text) {
  if (!text) return false;
  const t = text.trim();
  const streetWord = /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|circle|cir|highway|hwy|parkway|pkwy|suite|ste|apt|apartment|unit)\b/i;
  const hasNumber = /\d/.test(t);
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(t);
  const hasPOBox = /\bp\.?\s*o\.?\s*box\b/i.test(t);
  return hasPOBox || hasZip || (hasNumber && streetWord.test(t));
}
