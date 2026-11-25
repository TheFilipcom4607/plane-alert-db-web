const GITHUB = 'https://github.com/sdr-enthusiasts/plane-alert-db';
const LIMIT = 200;
const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

let planes = [];         // { cells, line, text }
let images = new Map();  // hex -> { urls, line }
let page = 0;

const q = document.getElementById('q');
const cat = document.getElementById('cat');
const rows = document.getElementById('rows');
const status = document.getElementById('status');
const pager = document.getElementById('pager');
const prev = document.getElementById('prev');
const next = document.getElementById('next');
const pageInfo = document.getElementById('page');

// Minimal CSV parser: commas, quoted fields, "" escapes.
function parseCSV(text) {
  const out = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out;
}

function el(tag, text, attrs = {}) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function isUrl(s) {
  return /^https?:\/\//i.test(s);
}

// github.com can't display plane-alert-db.csv (too big) and can't edit a file
// pinned to a commit, so edit links open the web editor (github.dev) on main.
// Lines can be off by a few if main changed since the last update.
function editUrl(file, line) {
  return `https://github.dev/sdr-enthusiasts/plane-alert-db/blob/main/${file}#L${line}`;
}

function render() {
  const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  const category = cat.value;
  const hits = planes.filter(p =>
    (!category || p.cells[9] === category) && terms.every(t => p.text.includes(t)));

  const pages = Math.max(1, Math.ceil(hits.length / LIMIT));
  page = Math.min(page, pages - 1);
  const shown = hits.slice(page * LIMIT, (page + 1) * LIMIT);
  rows.replaceChildren(...shown.map(row));
  status.textContent = `${hits.length} of ${planes.length} aircraft`;
  if (!hits.length) {
    status.append(' · Missing one? ', el('a', 'Add it on GitHub', { href: `${GITHUB}#contributing` }));
  }
  pager.hidden = pages === 1;
  pageInfo.textContent = `Page ${page + 1} of ${pages}`;
  prev.disabled = page === 0;
  next.disabled = page === pages - 1;
}

function row(p) {
  const c = p.cells;
  const tr = el('tr');
  const category = el('td');
  if (c[9]) category.append(el('span', c[9], { class: 'pill' }));
  const edit = el('td');
  const pencil = el('a', '', { href: editUrl('plane-alert-db.csv', p.line), title: 'Edit on GitHub', class: 'edit' });
  pencil.innerHTML = PENCIL;
  edit.append(pencil);
  tr.append(
    el('td', c[0], { class: 'mono' }), el('td', c[1], { class: 'mono' }), el('td', c[2]), el('td', c[3]),
    el('td', c[4], { class: 'mono' }), el('td', c[5]),
    el('td', [c[6], c[7], c[8]].filter(Boolean).join(', '), { class: 'tags' }),
    category, edit);
  tr.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    if (tr.nextSibling && tr.nextSibling.classList.contains('detail')) tr.nextSibling.remove();
    else tr.after(detail(p));
  });
  return tr;
}

function detail(p) {
  const tr = el('tr', '', { class: 'detail' });
  const td = el('td', '', { colspan: 9 });
  const img = images.get(p.cells[0]);

  const photos = el('div', '', { class: 'photos' });
  for (const url of img ? img.urls : []) {
    const a = el('a', '', { href: url });
    const image = el('img', '', { src: url, loading: 'lazy', alt: '' });
    image.addEventListener('error', () => a.remove());  // dead links: hide, don't show a broken icon
    a.append(image);
    photos.append(a);
  }
  if (!photos.children.length) photos.append(el('span', 'No photos yet.', { class: 'none' }));

  const links = el('p');
  if (isUrl(p.cells[10])) links.append(el('a', 'More info', { href: p.cells[10] }), ' · ');
  links.append(el('a', 'Edit this aircraft', { href: editUrl('plane-alert-db.csv', p.line) }));
  if (img) {
    links.append(' · ', el('a', img.urls.length ? 'Edit photos' : 'Add photos',
      { href: editUrl('plane_images.csv', img.line) }));
  }

  td.append(photos, links);
  tr.append(td);
  return tr;
}

async function load() {
  try {
    const v = await (await fetch('data/version.json')).json();
    const dataCommit = document.getElementById('data-commit');
    dataCommit.textContent = v.sha.slice(0, 7);
    dataCommit.href = `${GITHUB}/commit/${v.sha}`;
    document.getElementById('fetched').textContent = `Data fetched ${new Date(v.fetched).toLocaleString()}`;

    const [db, img] = await Promise.all(['plane-alert-db.csv', 'plane_images.csv'].map(f =>
      fetch(`data/${f}`).then(r => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.text(); })));

    // Header is line 1, so the first data row is line 2. No field contains a newline.
    planes = parseCSV(db).slice(1).map((cells, i) => ({
      cells, line: i + 2, text: cells.slice(0, 10).join('\t').toLowerCase(), // not the link column
    }));
    parseCSV(img).slice(1).forEach((cells, i) => {
      images.set(cells[0], { urls: cells.slice(1).filter(isUrl), line: i + 2 });
    });

    const categories = [...new Set(planes.map(p => p.cells[9]))].filter(Boolean).sort();
    cat.append(...categories.map(c => el('option', c, { value: c })));
    render();
  } catch (e) {
    status.textContent = `Could not load the database (${e.message}). It may still be downloading, try again in a minute.`;
  }
}

document.getElementById('form').addEventListener('submit', e => e.preventDefault());
function goTo(p) {
  page = p;
  render();
  document.querySelector('.scroll').scrollIntoView();
}

q.addEventListener('input', () => { page = 0; render(); });
cat.addEventListener('change', () => { page = 0; render(); });
prev.addEventListener('click', () => goTo(page - 1));
next.addEventListener('click', () => goTo(page + 1));
load();
