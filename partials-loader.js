// Loads every element with a data-include attribute by fetching the
// referenced HTML file and swapping it into the page, then starts
// js/script.js only once every section has actually loaded — script.js
// expects the real page elements (grid, countLine, roleToggle, etc.)
// to already exist the moment it runs.

async function loadPartials() {
  const nodes = [...document.querySelectorAll('[data-include]')];
  await Promise.all(nodes.map(async (node) => {
    const url = node.getAttribute('data-include');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      node.outerHTML = await res.text();
    } catch (err) {
      console.error('Failed to load partial:', url, err);
    }
  }));
}

loadPartials().then(() => {
  import('./js/app.js');
});
