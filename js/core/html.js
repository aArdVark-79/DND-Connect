// Generic HTML-escaping helpers used throughout the app whenever
// user-supplied text is inserted into innerHTML or an HTML attribute.

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
