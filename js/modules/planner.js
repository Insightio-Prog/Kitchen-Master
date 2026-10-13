/* Menu Planner: pick each day's lunch and dinner from The Source, set guest numbers and how many of each dish to cook.
   Data: one document per week (id = the Monday's date, e.g. 2026-10-12). Saved to the shared database when it exists,
   otherwise to this browser. Reads recipes from window.KM (published by js/modules/source.js). */
(function () {
  'use strict';
  var root = document.getElementById('planner-root');
  if (!root) return;

  var DAYS = [['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];
  var MEALS = [['lunch', 'Lunch'], ['dinner', 'Dinner']];
  var SECTIONS = [['soup', 'Soup'], ['mains', 'Mains'], ['veg', 'Vegetarian & vegan'], ['sides', 'Sides & extras']];
  var AL = { celery: 'Celery', gluten: 'Gluten', crustaceans: 'Crustaceans', eggs: 'Eggs', fish: 'Fish', lupin: 'Lupin', milk: 'Milk', molluscs: 'Molluscs', mustard: 'Mustard', nuts: 'Nuts', peanuts: 'Peanuts', sesame: 'Sesame', soya: 'Soya', sulphites: 'Sulphites' };
  var LS_KEY = 'kitchenmaster.menus.v1';
  var STEP = 5;

  var P = { menus: {}, loaded: false, store: 'loading', week: mondayOf(new Date()), day: 0, picker: null, q: '', recipes: [], byId: {} };
  var ref = null, dirty = {}, timers = {}, seeded = false;
  P.day = Math.min(6, Math.max(0, (new Date().getDay() + 6) % 7));

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v) { v = String(v == null ? '' : v).trim(); if (v === '') return null; var n = parseInt(v, 10); return isFinite(n) && n >= 0 ? n : null; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(s, o) { return parse(s).toLocaleDateString('en-GB', o); }

  /* ---------- data shape ---------- */
  function blankMeal() { return { guests: null, soup: [], mains: [], veg: [], sides: [] }; }
  function blankDay() { return { lunch: blankMeal(), dinner: blankMeal() }; }
  function blankWeek(s) { var d = []; for (var i = 0; i < 7; i++) d.push(blankDay()); return { weekStart: s, days: d }; }
  function normWeek(w, id) {
    var out = blankWeek(w && w.weekStart || id);
    ((w && w.days) || []).slice(0, 7).forEach(function (day, i) {
      MEALS.forEach(function (m) {
        var src = (day && day[m[0]]) || {}, dst = out.days[i][m[0]];
        dst.guests = src.guests == null ? null : src.guests;
        SECTIONS.forEach(function (s) { dst[s[0]] = Array.isArray(src[s[0]]) ? src[s[0]] : []; });
      });
    });
    return out;
  }
  function getW(s) { return P.menus[s] || blankWeek(s); }
  function countItems(w) { var n = 0; w.days.forEach(function (d) { MEALS.forEach(function (m) { SECTIONS.forEach(function (s) { n += d[m[0]][s[0]].length; }); }); }); return n; }
  function dayCount(d) { var n = 0; MEALS.forEach(function (m) { SECTIONS.forEach(function (s) { n += d[m[0]][s[0]].length; }); }); return n; }
  function edit(fn) {
    var s = P.week, w = P.menus[s] || (P.menus[s] = blankWeek(s));
    fn(w); queueSave(s);
  }

  /* ---------- storage ---------- */
  function lsRead() { try { var v = JSON.parse(localStorage.getItem(LS_KEY)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function lsWrite() { try { localStorage.setItem(LS_KEY, JSON.stringify(P.menus)); } catch (e) { } }
  function queueSave(s) {
    dirty[s] = true; clearTimeout(timers[s]);
    timers[s] = setTimeout(function () { flush(s); }, 400);
    setStatus('Saving');
  }
  function flush(s) {
    var w = P.menus[s]; if (!w) { delete dirty[s]; return; }
    if (P.store === 'db' && ref) {
      ref.doc(s).set(clone(w)).then(function () { delete dirty[s]; setStatus('Saved'); }, function () { setStatus('Could not save'); });
    } else { lsWrite(); delete dirty[s]; setStatus('Saved'); }
  }
  function setStatus(t) { var e = $('#pl-status'); if (e) e.textContent = t; }
  function useLocal() {
    P.store = 'local';
    var saved = lsRead();
    if (saved) { Object.keys(saved).forEach(function (k) { P.menus[k] = normWeek(saved[k], k); }); }
    else if (window.KM_MENU_SEED) { Object.keys(window.KM_MENU_SEED).forEach(function (k) { P.menus[k] = normWeek(clone(window.KM_MENU_SEED[k]), k); }); lsWrite(); }
    P.loaded = true; render();
  }
  (async function init() {
    var db = null;
    try { db = (window.claude && window.claude.use) ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (!db) { useLocal(); return; }
    P.store = 'db'; ref = db.collection('menus');
    ref.onSnapshot(function (snap) {
      snap.docs.forEach(function (d) { if (!dirty[d.id]) P.menus[d.id] = normWeek(d.data(), d.id); });
      Object.keys(P.menus).forEach(function (k) { if (!dirty[k] && !snap.docs.some(function (d) { return d.id === k; })) delete P.menus[k]; });
      P.loaded = true;
      if (!snap.docs.length && !seeded && window.KM_MENU_SEED) {
        seeded = true;
        Object.keys(window.KM_MENU_SEED).forEach(function (k) { P.menus[k] = normWeek(clone(window.KM_MENU_SEED[k]), k); flush(k); });
      }
      var a = document.activeElement;
      if (a && root.contains(a) && (a.tagName === 'INPUT') && a.id !== 'pq') { updateDerived(); return; }
      render();
    }, function () { useLocal(); });
  })();

  /* ---------- recipes from The Source ---------- */
  function setRecipes(list) {
    P.recipes = (list || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    P.byId = {}; P.recipes.forEach(function (r) { P.byId[r.id] = r; });
    if (P.loaded) { if (P.picker) renderPickerList(); updateTags(); }
  }
  if (window.KM && window.KM.onRecipes) window.KM.onRecipes(setRecipes);

  /* ---------- views ---------- */
  function chipsFor(r) {
    if (!r) return P.recipes.length ? '<span class="ch warn">Recipe removed</span>' : '';
    var out = [], a = r.additional || {};
    if (a.lifestyle === 'Vegan') out.push('<span class="ch ok">Vegan</span>');
    else if (a.lifestyle === 'Vegetarian') out.push('<span class="ch ok">Vegetarian</span>');
    if (!r.allergensChecked) out.push('<span class="ch warn" title="Allergens have not been confirmed for this recipe">Allergens unconfirmed</span>');
    var c = [], m = 0;
    Object.keys(AL).forEach(function (k) { var s = r.allergens && r.allergens[k]; if (s === 'contains') c.push(AL[k]); else if (s === 'may') m++; });
    c.forEach(function (n) { out.push('<span class="ch cn">' + esc(n) + '</span>'); });
    if (m) out.push('<span class="ch may" title="May contain">+' + m + ' may</span>');
    return out.join('');
  }
  function pct(cook, guests) { return (cook && guests) ? Math.round(cook / guests * 100) + '% of guests' : ''; }
  function itemHTML(it, meal, sec, guests) {
    var r = it.recipeId ? P.byId[it.recipeId] : null;
    var name = r ? r.name : it.name;
    return '<li class="pi" data-id="' + esc(it.id) + '"><div class="pi-main"><span class="pi-name">' + esc(name) + '</span>' +
      '<span class="pi-tags" data-tags="' + esc(it.recipeId || '') + '">' + (it.recipeId ? chipsFor(r) : '<span class="ch">Custom</span>') + '</span></div>' +
      '<div class="cook"><span class="lbl">Cook</span><div class="stepper">' +
      '<button class="icon-btn" type="button" data-pact="c-dec" data-meal="' + meal + '" data-sec="' + sec + '" data-id="' + esc(it.id) + '" aria-label="Fewer ' + esc(name) + '">−</button>' +
      '<input class="cin" inputmode="numeric" value="' + (it.cook == null ? '' : it.cook) + '" placeholder="0" data-meal="' + meal + '" data-sec="' + sec + '" data-id="' + esc(it.id) + '" aria-label="Portions of ' + esc(name) + '">' +
      '<button class="icon-btn" type="button" data-pact="c-inc" data-meal="' + meal + '" data-sec="' + sec + '" data-id="' + esc(it.id) + '" aria-label="More ' + esc(name) + '">+</button></div>' +
      '<span class="pct" data-pct="' + esc(it.id) + '">' + pct(it.cook, guests) + '</span></div>' +
      '<button class="icon-btn rmi" type="button" data-pact="rm" data-meal="' + meal + '" data-sec="' + sec + '" data-id="' + esc(it.id) + '" aria-label="Remove ' + esc(name) + '">×</button></li>';
  }
  function pickerHTML() {
    return '<div class="picker"><label class="fld"><span>Search The Source</span><input id="pq" type="search" autocomplete="off" placeholder="Dish or ingredient" value="' + esc(P.q) + '"></label>' +
      '<ul class="plist" id="plist"></ul><div class="picker-foot"><button class="btn" type="button" data-pact="p-close">Done</button></div></div>';
  }
  function sectionHTML(meal, sec, label, m) {
    var items = m[sec];
    var open = P.picker && P.picker.meal === meal && P.picker.sec === sec;
    return '<div class="psec"><div class="psec-head"><h4>' + label + '</h4>' + (items.length ? '<span class="lbl">' + items.length + (items.length === 1 ? ' dish' : ' dishes') + '</span>' : '') + '</div>' +
      (items.length ? '<ul class="pitems">' + items.map(function (it) { return itemHTML(it, meal, sec, m.guests); }).join('') + '</ul>' : '<p class="dim none">Nothing added</p>') +
      (open ? pickerHTML() : '<button class="btn add" type="button" data-pact="p-open" data-meal="' + meal + '" data-sec="' + sec + '">+ Add dish</button>') + '</div>';
  }
  function footText(m) {
    var main = 0, soup = 0;
    m.mains.concat(m.veg, m.sides).forEach(function (i) { main += i.cook || 0; });
    m.soup.forEach(function (i) { soup += i.cook || 0; });
    var parts = [];
    if (soup) parts.push('Soup ' + soup);
    if (main) parts.push('Mains, veg and sides ' + main);
    if (!parts.length) return 'Set how many of each dish to cook.';
    var t = parts.join(' · ') + ' portions';
    if (m.guests && main) t += ' · ' + Math.round(main / m.guests * 100) + '% of guests';
    return t;
  }
  function mealHTML(meal, label, d) {
    var m = d[meal];
    return '<section class="meal" aria-label="' + label + '"><div class="meal-head"><h3>' + label + '</h3>' +
      '<div class="guests"><span class="lbl">Guests</span><div class="stepper">' +
      '<button class="icon-btn" type="button" data-pact="g-dec" data-meal="' + meal + '" aria-label="Fewer ' + label + ' guests">−</button>' +
      '<input class="gin" inputmode="numeric" value="' + (m.guests == null ? '' : m.guests) + '" placeholder="0" data-meal="' + meal + '" aria-label="' + label + ' guests">' +
      '<button class="icon-btn" type="button" data-pact="g-inc" data-meal="' + meal + '" aria-label="More ' + label + ' guests">+</button></div></div></div>' +
      SECTIONS.map(function (s) { return sectionHTML(meal, s[0], s[1], m); }).join('') +
      '<p class="meal-foot" data-foot="' + meal + '">' + esc(footText(m)) + '</p></section>';
  }
  function render() {
    if (!P.loaded) { root.innerHTML = '<div class="empty"><h2>Loading menus</h2><p>Fetching the planner.</p></div>'; return; }
    var w = getW(P.week), d = w.days[P.day], today = iso(new Date());
    var empty = countItems(w) === 0, prev = P.menus[addDays(P.week, -7)];
    var tabs = DAYS.map(function (n, i) {
      var date = addDays(P.week, i), cnt = dayCount(w.days[i]);
      return '<button class="dtab" type="button" role="tab" data-pact="day" data-i="' + i + '" aria-selected="' + (i === P.day) + '"' + (date === today ? ' data-today="1"' : '') + '>' +
        '<span class="dn">' + n[0] + '</span><span class="dd">' + fmt(date, { day: 'numeric', month: 'short' }) + '</span><span class="dc">' + (cnt ? cnt + ' dishes' : 'empty') + '</span></button>';
    }).join('');
    root.innerHTML =
      '<div class="weeknav"><div class="wn-l"><button class="icon-btn" type="button" data-pact="wk-prev" aria-label="Previous week">‹</button>' +
      '<div class="wn-t"><b>Week of ' + fmt(P.week, { day: 'numeric', month: 'long', year: 'numeric' }) + '</b></div>' +
      '<button class="icon-btn" type="button" data-pact="wk-next" aria-label="Next week">›</button></div>' +
      '<div class="wn-r"><button class="btn" type="button" data-pact="wk-today">This week</button><button class="btn" type="button" data-pact="print">Print</button><span class="tot" id="pl-status" role="status"></span></div></div>' +
      '<div class="daytabs" role="tablist" aria-label="Days of the week">' + tabs + '</div>' +
      (empty ? '<div class="banner"><span>Nothing planned for this week yet. Pick a day and add dishes from The Source.</span>' + (prev && countItems(prev) ? '<button class="btn" type="button" data-pact="copy-prev">Copy last week’s menu</button>' : '') + '</div>' : '') +
      '<h2 class="dayhead">' + DAYS[P.day][1] + ' <small>' + fmt(addDays(P.week, P.day), { day: 'numeric', month: 'long' }) + '</small></h2>' +
      '<div class="meals">' + MEALS.map(function (m) { return mealHTML(m[0], m[1], d); }).join('') + '</div>';
    if (P.picker) renderPickerList();
  }
  function renderPickerList() {
    var ul = $('#plist'); if (!ul) return;
    var q = P.q.trim().toLowerCase();
    var list = P.recipes.filter(function (r) {
      if (!q) return true;
      return (r.name + ' ' + r.ingredients.map(function (i) { return i.name; }).join(' ')).toLowerCase().indexOf(q) >= 0;
    });
    var html = list.slice(0, 40).map(function (r) {
      return '<li><button type="button" class="pick" data-pact="pick" data-rid="' + esc(r.id) + '"><span class="pn2">' + esc(r.name) + '</span><span class="pi-tags">' + chipsFor(r) + '</span></button></li>';
    }).join('');
    if (list.length > 40) html += '<li class="dim more">Showing 40 of ' + list.length + '. Type to narrow the list.</li>';
    if (!list.length) html = '<li class="dim more">No recipe matches.</li>';
    if (q) html += '<li><button type="button" class="pick custom" data-pact="p-custom">Add “' + esc(P.q.trim()) + '” as a custom item (no recipe)</button></li>';
    ul.innerHTML = html;
  }
  function updateTags() {
    root.querySelectorAll('[data-tags]').forEach(function (e) { var id = e.dataset.tags; if (id) e.innerHTML = chipsFor(P.byId[id]); });
  }
  function updateDerived() {
    var w = getW(P.week), d = w.days[P.day];
    MEALS.forEach(function (m) {
      var meal = d[m[0]], f = $('[data-foot="' + m[0] + '"]'); if (f) f.textContent = footText(meal);
      SECTIONS.forEach(function (s) { meal[s[0]].forEach(function (it) { var p = $('[data-pct="' + it.id + '"]'); if (p) p.textContent = pct(it.cook, meal.guests); }); });
    });
  }
  function findItem(meal, sec, id) {
    var w = P.menus[P.week]; if (!w) return null;
    return w.days[P.day][meal][sec].filter(function (i) { return i.id === id; })[0] || null;
  }

  /* ---------- events ---------- */
  root.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'pq') { P.q = t.value; renderPickerList(); return; }
    if (t.classList.contains('gin')) {
      var g = num(t.value); edit(function (w) { w.days[P.day][t.dataset.meal].guests = g; }); updateDerived();
    } else if (t.classList.contains('cin')) {
      var c = num(t.value); edit(function (w) { var it = findItem(t.dataset.meal, t.dataset.sec, t.dataset.id); if (it) it.cook = c; }); updateDerived();
    }
  });
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pact]'); if (!t) return;
    var a = t.dataset.pact, meal = t.dataset.meal, sec = t.dataset.sec, id = t.dataset.id;
    switch (a) {
      case 'day': P.day = +t.dataset.i; P.picker = null; render(); break;
      case 'wk-prev': P.week = addDays(P.week, -7); P.picker = null; render(); break;
      case 'wk-next': P.week = addDays(P.week, 7); P.picker = null; render(); break;
      case 'wk-today': P.week = mondayOf(new Date()); P.day = (new Date().getDay() + 6) % 7; P.picker = null; render(); break;
      case 'print': window.print(); break;
      case 'copy-prev':
        edit(function (w) {
          var p = clone(P.menus[addDays(P.week, -7)]);
          p.days.forEach(function (day, i) { MEALS.forEach(function (m) { var src = day[m[0]], dst = w.days[i][m[0]]; dst.guests = null; SECTIONS.forEach(function (s) { dst[s[0]] = src[s[0]].map(function (it) { return { id: uid(), recipeId: it.recipeId || null, name: it.name, cook: null }; }); }); }); });
        }); render(); break;
      case 'g-inc': case 'g-dec':
        edit(function (w) { var m = w.days[P.day][meal]; m.guests = Math.max(0, (m.guests || 0) + (a === 'g-inc' ? STEP : -STEP)); }); render(); break;
      case 'c-inc': case 'c-dec':
        edit(function (w) { var it = findItem(meal, sec, id); if (it) it.cook = Math.max(0, (it.cook || 0) + (a === 'c-inc' ? STEP : -STEP)); }); render(); break;
      case 'rm':
        edit(function (w) { var l = w.days[P.day][meal][sec]; w.days[P.day][meal][sec] = l.filter(function (i) { return i.id !== id; }); }); render(); break;
      case 'p-open': P.picker = { meal: meal, sec: sec }; P.q = ''; render(); var q = $('#pq'); if (q) q.focus(); break;
      case 'p-close': P.picker = null; render(); break;
      case 'pick':
        var r = P.byId[t.dataset.rid]; if (!r || !P.picker) break;
        var pk = P.picker;
        edit(function (w) { w.days[P.day][pk.meal][pk.sec].push({ id: uid(), recipeId: r.id, name: r.name, cook: null }); });
        P.picker = null; render(); break;
      case 'p-custom':
        var nm = P.q.trim(); if (!nm || !P.picker) break;
        var pc = P.picker;
        edit(function (w) { w.days[P.day][pc.meal][pc.sec].push({ id: uid(), recipeId: null, name: nm, cook: null }); });
        P.picker = null; render(); break;
    }
  });
  window.addEventListener('beforeunload', function () { Object.keys(dirty).forEach(function (s) { if (P.store !== 'db') flush(s); }); });
})();
