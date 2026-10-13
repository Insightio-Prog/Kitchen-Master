/* The Source: recipe book module. Loaded after js/data/recipes.seed.js and js/nav.js. */
(function () {
  'use strict';

  var ALLERGENS = [
    ['celery', 'Celery'], ['gluten', 'Cereals containing gluten'], ['crustaceans', 'Crustaceans'],
    ['eggs', 'Eggs'], ['fish', 'Fish'], ['lupin', 'Lupin'], ['milk', 'Milk'], ['molluscs', 'Molluscs'],
    ['mustard', 'Mustard'], ['nuts', 'Tree nuts'], ['peanuts', 'Peanuts'], ['sesame', 'Sesame'],
    ['soya', 'Soybeans'], ['sulphites', 'Sulphur dioxide / sulphites']
  ];
  var UNITS = ['g', 'kg', 'ml', 'l', 'each'];
  var SUPPLIERS = ['Brakes Chilled Ltd', 'Brakes Ambient', 'Brakes Frozen Foodservice Ltd', 'Brakes Fresh'];
  var RI = { kcal: 2000, fat: 70, sat: 20, sugars: 90, salt: 6 };
  var LS_KEY = 'kitchenmaster.recipes.v1';

  var SAMPLE = {
    id: 'veg-bean-chilli',
    name: 'Vegetable & Bean Chilli with Brown Rice',
    planDate: '2025-05-09',
    plu: '93156204', priceBand: 'N/A', portions: 10, proteinType: 'Other', portionWeight: 424,
    nutrition: { kj: 1272, kcal: 304, fat: 5.3, sat: 0.6, sugars: 7.5, salt: 0.04, kj100: 301, kcal100: 72 },
    ingredients: [
      { qty: 200, unit: 'g', name: 'Onion Cooking Premium 2.5KG', supplier: 'Brakes Chilled Ltd', code: '10469' },
      { qty: 1, unit: 'kg', name: 'Red Kidney Beans 800g', supplier: 'Brakes Ambient', code: '116544' },
      { qty: 300, unit: 'g', name: 'Pepper Green Premium 5KG', supplier: 'Brakes Chilled Ltd', code: '13006' },
      { qty: 300, unit: 'g', name: 'Mushroom Catering 3KG', supplier: 'Brakes Chilled Ltd', code: '450114' },
      { qty: 15, unit: 'g', name: 'Garlic Greens Chopped 250g', supplier: 'Brakes Frozen Foodservice Ltd', code: '110718' },
      { qty: 30, unit: 'ml', name: 'Oil Rapeseed Extended Life B/B 20L', supplier: 'Brakes Ambient', code: '21557' },
      { qty: 10, unit: 'g', name: 'Spice Chilli Powder Hot Sysco 500g', supplier: 'Brakes Ambient', code: '35016' },
      { qty: 1, unit: 'kg', name: 'Tomatoes Peeled Plum Can Riverdene 2.5KG', supplier: 'Brakes Ambient', code: '119066' },
      { qty: 75, unit: 'g', name: 'Paste Tomato 800g', supplier: 'Brakes Ambient', code: '119065' },
      { qty: 300, unit: 'g', name: 'Courgettes', supplier: 'Brakes Chilled Ltd', code: '10303' },
      { qty: 300, unit: 'g', name: 'Carrots', supplier: 'Brakes Chilled Ltd', code: '10415' },
      { qty: 500, unit: 'g', name: 'Rice Brown Long Grain 5KG', supplier: '', code: '' }
    ],
    method: [
      'Chop the onions & roughly dice courgettes, carrots & peppers.',
      'Slice the mushrooms. Finely chop the garlic.',
      'Heat the oil in a suitably sized saucepan and saute the onions, garlic and carrots for 5-8 mins until soft.',
      'Add the courgettes and mushrooms and the chilli powder and continue to cook for a couple of minutes.',
      'Add the chopped tomatoes, tomato puree and stir well.',
      'Add the red kidney beans and simmer for approx 30 minutes until the core temperature has been reached (75°C Eng 82°C Scot).',
      'Steam or boil the rice until tender and serve with the chilli.'
    ],
    comments: '', servingSuggestions: '',
    additional: { complexity: 3, dayParts: 'Lunch', lifestyle: 'None Listed', segment: 'None Listed', season: 'None Listed' },
    allergens: {}, allergensChecked: false, updatedAt: ''
  };

  var S = { recipes: [], loaded: false, store: 'loading', selId: null, mode: 'view', target: null, q: '', draft: null, confirmDelete: false };
  var recipesRef = null;
  var app = document.getElementById('app');

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return 'r-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function num(v) { v = String(v == null ? '' : v).trim().replace(',', '.'); if (v === '') return null; var n = parseFloat(v); return isFinite(n) ? n : null; }
  function trim(n, dp) { return String(+n.toFixed(dp)); }
  function wide() { return window.matchMedia('(min-width: 900px)').matches; }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00'); if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function fmtStamp(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtQty(q, unit) {
    if (q == null) return { n: '—', u: '' };
    var u = unit;
    if (u === 'g' && q >= 1000) { q /= 1000; u = 'kg'; }
    else if (u === 'kg' && q < 1) { q *= 1000; u = 'g'; }
    else if (u === 'ml' && q >= 1000) { q /= 1000; u = 'l'; }
    else if (u === 'l' && q < 1) { q *= 1000; u = 'ml'; }
    var dp = (u === 'g' || u === 'ml') ? (q < 10 ? 1 : 0) : (u === 'each' ? 1 : 2);
    return { n: trim(q, dp), u: String(u).toUpperCase() };
  }
  function normalize(r) {
    var n = clone(r || {});
    if (n.name == null) n.name = '';
    if (n.portions == null) n.portions = 10;
    n.ingredients = Array.isArray(n.ingredients) ? n.ingredients : [];
    n.method = Array.isArray(n.method) ? n.method : [];
    n.nutrition = n.nutrition || {};
    n.additional = Object.assign({ complexity: 3, dayParts: '', lifestyle: 'None Listed', segment: 'None Listed', season: 'None Listed' }, n.additional || {});
    n.allergens = n.allergens || {};
    ALLERGENS.forEach(function (a) { if (['none', 'may', 'contains'].indexOf(n.allergens[a[0]]) < 0) n.allergens[a[0]] = 'none'; });
    n.allergensChecked = !!n.allergensChecked;
    return n;
  }
  function blank() {
    return normalize({ id: uid(), name: '', portions: 10, ingredients: [{ qty: null, unit: 'g', name: '', supplier: '', code: '' }], method: [''] });
  }
  function factor(r) { return (S.target && r.portions) ? S.target / r.portions : 1; }
  function byName(a, b) { return a.name.localeCompare(b.name); }
  function current() { return S.recipes.filter(function (x) { return x.id === S.selId; })[0] || null; }

  function allergenSummary(r) {
    if (!r.allergensChecked) return { cls: 'warn', text: 'Allergens not confirmed' };
    var c = [], m = [];
    ALLERGENS.forEach(function (a) { var s = r.allergens[a[0]]; if (s === 'contains') c.push(a[1]); else if (s === 'may') m.push(a[1]); });
    if (!c.length && !m.length) return { cls: 'ok', text: 'No listed allergens' };
    return { cls: 'info', text: (c.length ? 'Contains ' + c.join(', ') : '') + (c.length && m.length ? ' · ' : '') + (m.length ? 'May contain ' + m.join(', ') : '') };
  }

  /* ---------- storage ---------- */
  function lsRead() { try { var v = JSON.parse(localStorage.getItem(LS_KEY)); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
  function lsWrite() { try { localStorage.setItem(LS_KEY, JSON.stringify(S.recipes)); } catch (e) { } }
  function useLocal() {
    S.store = 'local';
    var saved = lsRead();
    S.recipes = (saved || (window.KM_SEED && window.KM_SEED.length ? window.KM_SEED : [SAMPLE])).map(normalize);
    S.loaded = true;
    fixSel(); render();
  }
  function upsert(r) {
    var i = S.recipes.findIndex(function (x) { return x.id === r.id; });
    if (i >= 0) S.recipes[i] = r; else S.recipes.push(r);
  }
  (async function init() {
    var db = null;
    try { db = (window.claude && window.claude.use) ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (!db) { useLocal(); return; }
    S.store = 'db';
    recipesRef = db.collection('recipes');
    recipesRef.onSnapshot(function (snap) {
      S.recipes = snap.docs.map(function (d) { return normalize(Object.assign({}, d.data(), { id: d.id })); });
      S.loaded = true;
      fixSel();
      if (S.mode === 'edit') { renderList(); renderStore(); } else render();
    }, function () { useLocal(); });
  })();

  function fixSel() {
    if (S.selId && !current() && S.mode !== 'edit') S.selId = null;
    if (!S.selId && S.mode !== 'edit' && wide() && S.recipes.length) {
      S.selId = S.recipes.slice().sort(byName)[0].id;
    }
    var r = current();
    if (r && (S.target == null || S.targetFor !== r.id)) { S.target = r.portions; S.targetFor = r.id; }
  }

  /* ---------- render ---------- */
  function render() {
    app.dataset.view = (S.selId || S.mode === 'edit') ? 'sheet' : 'list';
    renderStore(); renderList(); renderMain();
  }
  function renderStore() {
    var el = $('#store');
    el.textContent = S.store === 'db' ? 'Synced across your devices' : S.store === 'local' ? 'Saved on this device only' : 'Loading';
  }
  function renderList() {
    var el = $('#list');
    if (!S.loaded) { el.innerHTML = '<li class="noresult">Loading recipes</li>'; return; }
    var q = S.q.trim().toLowerCase();
    var list = S.recipes.filter(function (r) {
      if (!q) return true;
      var hay = [r.name, r.plu].concat(r.ingredients.map(function (i) { return i.name + ' ' + i.code; })).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    }).sort(byName);
    if (!list.length) { el.innerHTML = '<li class="noresult">' + (S.recipes.length ? 'No recipe matches that search.' : 'No recipes yet.') + '</li>'; return; }
    el.innerHTML = list.map(function (r) {
      var s = allergenSummary(r);
      return '<li><button type="button" class="item' + (r.id === S.selId && S.mode === 'view' ? ' on' : '') + '" data-act="select" data-id="' + esc(r.id) + '"' + (r.id === S.selId ? ' aria-current="true"' : '') + '>' +
        '<span class="in">' + esc(r.name || 'Untitled recipe') + '</span>' +
        '<span class="im">' + esc(r.portions) + ' portions' + (r.additional.dayParts ? ' · ' + esc(r.additional.dayParts) : '') + '</span>' +
        '<span class="ia ' + s.cls + '">' + esc(s.text) + '</span></button></li>';
    }).join('');
  }
  function renderMain() {
    var m = $('#main');
    if (S.mode === 'edit') { m.innerHTML = formHTML(S.draft); return; }
    if (!S.loaded) { m.innerHTML = '<div class="empty"><h2>Loading recipes</h2><p>Fetching your recipe book.</p></div>'; return; }
    var r = current();
    if (!r) {
      m.innerHTML = S.recipes.length
        ? '<div class="empty"><h2>Choose a recipe</h2><p>Pick one from the shelf to see the full sheet and scale it to the numbers you are cooking for.</p></div>'
        : '<div class="empty"><h2>No recipes yet</h2><p>Add your first recipe with its Brakes product codes. Menus, stock and orders all build on these.</p><button class="btn primary" type="button" data-act="new">Add a recipe</button></div>';
      return;
    }
    m.innerHTML = viewHTML(r);
  }

  function scaleBar(r) {
    var changed = S.target !== r.portions;
    return '<div class="scale"><div class="scale-l"><span class="lbl">Cooking for</span>' +
      '<div class="stepper"><button class="icon-btn" type="button" data-act="t-dec" aria-label="One fewer portion">−</button>' +
      '<input id="target" inputmode="numeric" value="' + S.target + '" aria-label="Portions to cook"><button class="icon-btn" type="button" data-act="t-inc" aria-label="One more portion">+</button></div>' +
      '<span class="lbl">portions</span></div>' +
      '<div class="chips" id="chips">' + chips(r) + '</div>' +
      '<div class="scale-r"><span id="factor" class="fx">×' + trim(factor(r), 2) + '</span>' +
      '<button type="button" id="reset" class="link" data-act="t-reset"' + (changed ? '' : ' hidden') + '>Back to ' + esc(r.portions) + '</button>' +
      '<span id="total" class="tot">' + totalText(r) + '</span></div></div>';
  }
  function chips(r) {
    return [10, 20, 40, 60, 100].map(function (n) {
      return '<button type="button" class="chip' + (S.target === n ? ' on' : '') + '" data-act="t-set" data-n="' + n + '">' + n + '</button>';
    }).join('');
  }
  function totalText(r) {
    if (!r.portionWeight) return '';
    var t = fmtQty(S.target * r.portionWeight, 'g');
    return t.n + ' ' + t.u + ' finished';
  }
  function ingBlock(r) {
    var f = factor(r), changed = Math.abs(f - 1) > 1e-9;
    var rows = r.ingredients.map(function (i) {
      var a = fmtQty(i.qty == null ? null : i.qty * f, i.unit);
      var o = (changed && i.qty != null) ? fmtQty(i.qty, i.unit) : null;
      return '<tr><td class="q"><b>' + a.n + '</b> <span class="u">' + a.u + '</span>' + (o ? '<span class="was">recipe: ' + o.n + ' ' + o.u + '</span>' : '') + '</td>' +
        '<td><span class="pn">' + esc(i.name) + '</span>' + (i.supplier ? '<span class="sup">' + esc(i.supplier) + '</span>' : '') + '</td>' +
        '<td>' + (i.code ? '<button type="button" class="code" data-act="copy" data-code="' + esc(i.code) + '" title="Copy code">' + esc(i.code) + '</button>' : '<span class="nocode">—</span>') + '</td></tr>';
    }).join('');
    return '<div class="tw"><table class="ing"><thead><tr><th>Qty</th><th>Product</th><th>Brakes code</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function tile(label, val, pct) {
    return '<div class="tile"><div class="tl">' + label + '</div><div class="tv">' + val + '</div><div class="tp">' + pct + '</div></div>';
  }
  function viewHTML(r) {
    var n = r.nutrition, a = r.additional;
    var g = function (v, u) { return v == null ? '—' : v + u; };
    var p = function (v, k) { return v == null ? '—' : Math.round(v / RI[k] * 100) + '%'; };
    var energy = n.kj == null && n.kcal == null ? '—' : (g(n.kj, 'kJ') + '<small>' + g(n.kcal, 'kcal') + '</small>');
    var hasNut = ['kj', 'kcal', 'fat', 'sat', 'sugars', 'salt'].some(function (k) { return n[k] != null; });
    var per100 = (n.kj100 != null || n.kcal100 != null) ? 'Typical values per 100g; Energy ' + g(n.kj100, 'kJ') + '/' + g(n.kcal100, 'kcal') : '';
    var hat = a.complexity ? 'Chef Hat ' + esc(a.complexity) : '';
    var als = ALLERGENS.map(function (x) {
      var s = r.allergens[x[0]];
      return '<div class="ali ' + (s === 'none' ? '' : s) + '"><b>' + x[1] + '</b><span>' + (s === 'contains' ? 'Contains' : s === 'may' ? 'May contain' : 'Not listed') + '</span></div>';
    }).join('');
    return '<div class="bar"><button class="btn back" type="button" data-act="back">← All recipes</button><div class="bar-r">' +
      '<button class="btn" type="button" data-act="edit">Edit</button><button class="btn" type="button" data-act="dup">Duplicate</button>' +
      (S.confirmDelete ? '<span class="confirm">Delete this recipe?</span><button class="btn danger" type="button" data-act="del-yes">Yes, delete</button><button class="btn" type="button" data-act="del-no">Keep it</button>'
        : '<button class="btn ghost-danger" type="button" data-act="del">Delete</button>') + '</div></div>' +
      scaleBar(r) +
      (r.allergensChecked ? '' : '<div class="banner"><span>Allergens have not been confirmed for this recipe. Do not rely on it for allergen checks yet.</span><button class="btn" type="button" data-act="edit-allergens">Check allergens</button></div>') +
      '<article class="sheet" aria-label="' + esc(r.name) + '">' +
      '<div class="sheet-head"><h1>' + esc(r.name) + '</h1>' + (r.planDate ? '<div class="plan"><small>Plan date</small>' + fmtDate(r.planDate) + '</div>' : '') + '</div>' +
      '<div class="top2"><dl class="meta"><dt>PLU Number</dt><dd>' + esc(r.plu || '—') + '</dd><dt>Recipe Price Band</dt><dd>' + esc(r.priceBand || '—') + '</dd>' +
      '<dt>Portions</dt><dd>' + esc(r.portions) + '</dd><dt>Protein Type</dt><dd>' + esc(r.proteinType || '—') + '</dd>' +
      '<dt>Portion Net Weight</dt><dd>' + (r.portionWeight ? esc(r.portionWeight) + ' g' : '—') + '</dd></dl>' +
      (hasNut ? '<div class="nutwrap"><span class="lbl">Per average serving</span><div class="nut">' +
        tile('Energy', energy, p(n.kcal, 'kcal')) + tile('Fat', g(n.fat, 'g'), p(n.fat, 'fat')) + tile('Saturates', g(n.sat, 'g'), p(n.sat, 'sat')) +
        tile('Sugars', g(n.sugars, 'g'), p(n.sugars, 'sugars')) + tile('Salt', g(n.salt, 'g'), p(n.salt, 'salt')) +
        '</div><p class="nutnote">of an adult’s Reference Intake (8400kJ / 2000kcal)' + (per100 ? '<br>' + per100 : '') + '</p></div>' : '') + '</div>' +
      '<div class="body"><section class="sec"><h2>Ingredients</h2><div id="ing-wrap">' + ingBlock(r) + '</div></section>' +
      '<section class="sec"><h2>Method</h2>' + (r.method.length ? '<ol class="method">' + r.method.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '<p class="dim">No method written yet.</p>') + '</section></div>' +
      '<div class="band"><section class="sec"><h2>Comments</h2>' + (r.comments ? '<p>' + esc(r.comments) + '</p>' : '<p class="dim">None</p>') + '</section>' +
      '<section class="sec"><h2>Serving suggestions</h2>' + (r.servingSuggestions ? '<p>' + esc(r.servingSuggestions) + '</p>' : '<p class="dim">None</p>') + '</section>' +
      '<section class="sec"><h2>Additional information</h2><dl class="add"><dt>Complexity Level</dt><dd>' + (hat || '—') + '</dd><dt>Day Parts</dt><dd>' + esc(a.dayParts || '—') + '</dd>' +
      '<dt>Lifestyle Indicator</dt><dd>' + esc(a.lifestyle || '—') + '</dd><dt>Consumer Segment</dt><dd>' + esc(a.segment || '—') + '</dd><dt>Time of Year</dt><dd>' + esc(a.season || '—') + '</dd></dl></section></div>' +
      '<section class="sec"><h2>Allergens</h2><div class="al">' + als + '</div></section>' +
      '<div class="foot">' + (r.updatedAt ? 'Last saved ' + fmtStamp(r.updatedAt) : 'Entered from the printed work sheet') + '</div></article>';
  }

  /* ---------- form ---------- */
  function fld(id, label, value, extra) {
    return '<label class="fld" for="' + id + '"><span>' + label + '</span><input id="' + id + '" value="' + esc(value == null ? '' : value) + '" ' + (extra || '') + '></label>';
  }
  function formHTML(d) {
    var isNew = !S.recipes.some(function (x) { return x.id === d.id; });
    var n = d.nutrition, a = d.additional;
    var ings = d.ingredients.map(function (i, k) {
      return '<div class="ing-row">' +
        '<label class="fld qty-f"><span>Qty</span><input id="i-qty-' + k + '" inputmode="decimal" value="' + esc(i.qty == null ? '' : i.qty) + '"></label>' +
        '<label class="fld"><span>Unit</span><select id="i-unit-' + k + '">' + UNITS.map(function (u) { return '<option' + (u === i.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld prod"><span>Product (as ordered)</span><input id="i-name-' + k + '" value="' + esc(i.name) + '"></label>' +
        '<label class="fld sup-f"><span>Supplier / range</span><input id="i-sup-' + k + '" list="suppliers" value="' + esc(i.supplier) + '"></label>' +
        '<label class="fld code-f"><span>Brakes code</span><input id="i-code-' + k + '" inputmode="numeric" value="' + esc(i.code) + '"></label>' +
        '<button type="button" class="icon-btn rm" data-act="rm-ing" data-idx="' + k + '" aria-label="Remove ingredient ' + (k + 1) + '">×</button></div>';
    }).join('');
    var steps = d.method.map(function (s, k) {
      return '<div class="step-row"><span class="stepn">' + (k + 1) + '</span><textarea id="s-' + k + '" rows="2" aria-label="Step ' + (k + 1) + '">' + esc(s) + '</textarea>' +
        '<div class="step-btns"><button type="button" class="icon-btn" data-act="up-step" data-idx="' + k + '" aria-label="Move step ' + (k + 1) + ' up"' + (k === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon-btn" data-act="dn-step" data-idx="' + k + '" aria-label="Move step ' + (k + 1) + ' down"' + (k === d.method.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="icon-btn" data-act="rm-step" data-idx="' + k + '" aria-label="Remove step ' + (k + 1) + '">×</button></div></div>';
    }).join('');
    var als = ALLERGENS.map(function (x) {
      var k = x[0], s = d.allergens[k];
      return '<fieldset class="alr"><legend>' + x[1] + '</legend><div class="seg">' +
        '<input type="radio" id="al-' + k + '-none" name="al-' + k + '" value="none"' + (s === 'none' ? ' checked' : '') + '><label for="al-' + k + '-none">None</label>' +
        '<input type="radio" class="m" id="al-' + k + '-may" name="al-' + k + '" value="may"' + (s === 'may' ? ' checked' : '') + '><label for="al-' + k + '-may">May contain</label>' +
        '<input type="radio" class="c" id="al-' + k + '-contains" name="al-' + k + '" value="contains"' + (s === 'contains' ? ' checked' : '') + '><label for="al-' + k + '-contains">Contains</label></div></fieldset>';
    }).join('');
    return '<form id="form" class="form" novalidate>' +
      '<div class="formhead"><button type="button" class="btn back" data-act="cancel">← Back</button><h1>' + (isNew ? 'New recipe' : 'Edit recipe') + '</h1></div>' +
      '<section class="card"><h2>Recipe details</h2><div class="g">' +
      '<div class="wide">' + fld('f-name', 'Recipe name', d.name, 'autocomplete="off"') + '</div>' +
      fld('f-plan', 'Plan date', d.planDate, 'type="date"') + fld('f-plu', 'PLU number', d.plu, 'inputmode="numeric"') + fld('f-band', 'Recipe price band', d.priceBand) +
      fld('f-portions', 'Portions this makes', d.portions, 'inputmode="numeric"') + fld('f-protein', 'Protein type', d.proteinType, 'list="proteins"') + fld('f-weight', 'Portion net weight (g)', d.portionWeight, 'inputmode="decimal"') +
      '</div></section>' +
      '<section class="card"><h2>Nutrition per serving</h2><div class="g">' +
      fld('n-kj', 'Energy (kJ)', n.kj, 'inputmode="decimal"') + fld('n-kcal', 'Energy (kcal)', n.kcal, 'inputmode="decimal"') + fld('n-fat', 'Fat (g)', n.fat, 'inputmode="decimal"') +
      fld('n-sat', 'Saturates (g)', n.sat, 'inputmode="decimal"') + fld('n-sugars', 'Sugars (g)', n.sugars, 'inputmode="decimal"') + fld('n-salt', 'Salt (g)', n.salt, 'inputmode="decimal"') +
      fld('n-kj100', 'Per 100g energy (kJ)', n.kj100, 'inputmode="decimal"') + fld('n-kcal100', 'Per 100g energy (kcal)', n.kcal100, 'inputmode="decimal"') +
      '</div></section>' +
      '<section class="card"><h2>Ingredients</h2><p class="dim">Quantities are for the portions above. Leave Qty empty for "to taste".</p><div>' + ings + '</div>' +
      '<button type="button" class="btn addrow" data-act="add-ing">+ Add ingredient</button></section>' +
      '<section class="card"><h2>Method</h2>' + steps + '<button type="button" class="btn addrow" data-act="add-step">+ Add step</button></section>' +
      '<section class="card"><h2>Notes</h2><div class="g">' +
      '<label class="fld wide" for="f-comments"><span>Comments</span><textarea id="f-comments" rows="3">' + esc(d.comments || '') + '</textarea></label>' +
      '<label class="fld wide" for="f-serving"><span>Serving suggestions</span><textarea id="f-serving" rows="3">' + esc(d.servingSuggestions || '') + '</textarea></label>' +
      '<label class="fld" for="a-complexity"><span>Complexity level (chef hats)</span><select id="a-complexity">' + [1, 2, 3, 4, 5].map(function (c) { return '<option value="' + c + '"' + (+a.complexity === c ? ' selected' : '') + '>Chef Hat ' + c + '</option>'; }).join('') + '</select></label>' +
      fld('a-day', 'Day parts', a.dayParts) + fld('a-life', 'Lifestyle indicator', a.lifestyle) + fld('a-seg', 'Consumer segment', a.segment) + fld('a-season', 'Time of year', a.season) +
      '</div></section>' +
      '<section class="card" id="sec-allergens"><h2>Allergens</h2><p class="dim">Set each of the 14 allergens from the product labels of every ingredient above.</p><div>' + als + '</div>' +
      '<label class="check" for="f-checked"><input type="checkbox" id="f-checked"' + (d.allergensChecked ? ' checked' : '') + '><span><b>I have checked these allergens against the product labels.</b><br><span class="dim">Until this is ticked the recipe shows as unconfirmed everywhere.</span></span></label></section>' +
      '<datalist id="suppliers">' + SUPPLIERS.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' +
      '<datalist id="proteins">' + ['Other', 'Beef', 'Chicken', 'Pork', 'Lamb', 'Fish', 'Vegetarian', 'Vegan'].map(function (s) { return '<option value="' + s + '">'; }).join('') + '</datalist>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="save">Save recipe</button><button type="button" class="btn" data-act="cancel">Cancel</button><span id="formerr" class="err" role="alert"></span></div></form>';
  }
  function readForm() {
    var d = S.draft, f = $('#form'); if (!f || !d) return;
    var v = function (id) { var e = f.querySelector('#' + id); return e ? e.value : ''; };
    d.name = v('f-name').trim(); d.planDate = v('f-plan'); d.plu = v('f-plu').trim(); d.priceBand = v('f-band').trim();
    d.portions = num(v('f-portions')); d.proteinType = v('f-protein').trim(); d.portionWeight = num(v('f-weight'));
    ['kj', 'kcal', 'fat', 'sugars', 'salt', 'kj100', 'kcal100'].forEach(function (k) { d.nutrition[k] = num(v('n-' + k)); });
    d.nutrition.sat = num(v('n-sat'));
    d.ingredients = d.ingredients.map(function (_, k) {
      return { qty: num(v('i-qty-' + k)), unit: v('i-unit-' + k) || 'g', name: v('i-name-' + k).trim(), supplier: v('i-sup-' + k).trim(), code: v('i-code-' + k).trim() };
    });
    d.method = d.method.map(function (_, k) { return v('s-' + k); });
    d.comments = v('f-comments'); d.servingSuggestions = v('f-serving');
    d.additional = { complexity: num(v('a-complexity')) || 3, dayParts: v('a-day').trim(), lifestyle: v('a-life').trim(), segment: v('a-seg').trim(), season: v('a-season').trim() };
    ALLERGENS.forEach(function (x) { var c = f.querySelector('input[name="al-' + x[0] + '"]:checked'); d.allergens[x[0]] = c ? c.value : 'none'; });
    d.allergensChecked = !!(f.querySelector('#f-checked') || {}).checked;
  }
  function formError(msg) { var e = $('#formerr'); if (e) e.textContent = msg; }

  async function save() {
    readForm();
    var r = clone(S.draft);
    if (!r.name) { formError('Give the recipe a name.'); $('#f-name').focus(); return; }
    if (!r.portions || r.portions <= 0) { formError('Enter how many portions the recipe makes.'); $('#f-portions').focus(); return; }
    r.ingredients = r.ingredients.filter(function (i) { return i.name || i.qty != null || i.code; });
    for (var k = 0; k < r.ingredients.length; k++) {
      if (!r.ingredients[k].name) { formError('Every ingredient needs a product name.'); return; }
    }
    r.method = r.method.map(function (s) { return s.trim(); }).filter(Boolean);
    r.updatedAt = new Date().toISOString();
    formError('');
    var btn = $('[data-act="save"]'); if (btn) btn.disabled = true;
    try {
      if (S.store === 'db') { var body = clone(r); delete body.id; await recipesRef.doc(r.id).set(body); }
      upsert(r);
      if (S.store !== 'db') lsWrite();
    } catch (e) {
      if (btn) btn.disabled = false;
      formError('Could not save. ' + ((e && e.code === 'quota_exceeded') ? 'The recipe book is full.' : 'Check your connection and try again.'));
      return;
    }
    S.selId = r.id; S.target = r.portions; S.targetFor = r.id; S.mode = 'view'; S.draft = null; S.confirmDelete = false;
    render(); window.scrollTo(0, 0); toast('Recipe saved');
  }
  async function remove() {
    var r = current(); if (!r) return;
    try {
      if (S.store === 'db') await recipesRef.doc(r.id).delete();
      S.recipes = S.recipes.filter(function (x) { return x.id !== r.id; });
      if (S.store !== 'db') lsWrite();
    } catch (e) { toast('Could not delete. Try again.'); return; }
    S.selId = null; S.confirmDelete = false; fixSel(); render(); toast('Recipe deleted');
  }

  /* ---------- scaling (live, keeps the input focused) ---------- */
  function setTarget(n, typed) {
    var r = current(); if (!r) return;
    n = Math.round(n); if (!isFinite(n) || n < 1) return;
    S.target = Math.min(n, 5000);
    var w = $('#ing-wrap'); if (w) w.innerHTML = ingBlock(r);
    $('#factor').textContent = '×' + trim(factor(r), 2);
    $('#total').textContent = totalText(r);
    $('#chips').innerHTML = chips(r);
    $('#reset').hidden = S.target === r.portions; $('#reset').textContent = 'Back to ' + r.portions;
    var inp = $('#target'); if (!typed && inp) inp.value = S.target;
  }

  /* ---------- events ---------- */
  app.addEventListener('submit', function (e) { e.preventDefault(); });
  app.addEventListener('input', function (e) {
    if (e.target.id === 'q') { S.q = e.target.value; renderList(); }
    else if (e.target.id === 'target') { var n = num(e.target.value); if (n != null) setTarget(n, true); }
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'target') { var n = num(e.target.value); if (n == null || n < 1) e.target.value = S.target; else setTarget(n); }
  });
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.dataset.act, idx = +t.dataset.idx, r = current();
    switch (act) {
      case 'select':
        S.selId = t.dataset.id; S.mode = 'view'; S.confirmDelete = false; S.targetFor = null; fixSel(); render(); window.scrollTo(0, 0); break;
      case 'back': S.selId = null; S.mode = 'view'; S.confirmDelete = false; render(); break;
      case 'new': S.draft = blank(); S.mode = 'edit'; S.selId = null; render(); window.scrollTo(0, 0); break;
      case 'edit': if (r) { S.draft = normalize(r); S.mode = 'edit'; render(); window.scrollTo(0, 0); } break;
      case 'edit-allergens': if (r) { S.draft = normalize(r); S.mode = 'edit'; render(); var s = $('#sec-allergens'); if (s) s.scrollIntoView(); } break;
      case 'dup': if (r) { var c = normalize(r); c.id = uid(); c.name = r.name + ' (copy)'; c.allergensChecked = false; c.updatedAt = ''; S.draft = c; S.mode = 'edit'; S.selId = null; render(); window.scrollTo(0, 0); } break;
      case 'cancel': S.mode = 'view'; S.draft = null; fixSel(); render(); break;
      case 'save': save(); break;
      case 'del': S.confirmDelete = true; renderMain(); break;
      case 'del-no': S.confirmDelete = false; renderMain(); break;
      case 'del-yes': remove(); break;
      case 'add-ing': readForm(); S.draft.ingredients.push({ qty: null, unit: 'g', name: '', supplier: '', code: '' }); renderMain(); var ni = $('#i-name-' + (S.draft.ingredients.length - 1)); if (ni) ni.focus(); break;
      case 'rm-ing': readForm(); S.draft.ingredients.splice(idx, 1); if (!S.draft.ingredients.length) S.draft.ingredients.push({ qty: null, unit: 'g', name: '', supplier: '', code: '' }); renderMain(); break;
      case 'add-step': readForm(); S.draft.method.push(''); renderMain(); var ns = $('#s-' + (S.draft.method.length - 1)); if (ns) ns.focus(); break;
      case 'rm-step': readForm(); S.draft.method.splice(idx, 1); renderMain(); break;
      case 'up-step': case 'dn-step': readForm(); var j = act === 'up-step' ? idx - 1 : idx + 1, m = S.draft.method;
        if (j >= 0 && j < m.length) { var tmp = m[idx]; m[idx] = m[j]; m[j] = tmp; } renderMain(); var fs = $('#s-' + j); if (fs) fs.focus(); break;
      case 't-inc': setTarget(S.target + 1); break;
      case 't-dec': setTarget(S.target - 1); break;
      case 't-set': setTarget(+t.dataset.n); break;
      case 't-reset': if (r) setTarget(r.portions); break;
      case 'copy':
        var code = t.dataset.code;
        try { navigator.clipboard.writeText(code).then(function () { toast('Copied ' + code); }, function () { toast('Code ' + code); }); } catch (x) { toast('Code ' + code); }
        break;
    }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', function () { if (S.mode !== 'edit') { fixSel(); render(); } });

  renderStore(); renderList(); renderMain();
})();
