/* Allergen Check: keep each group's timetable and dietary needs, then check every dish on the week's menu against them.
   Data: one document per group (collection "groups"). Saved to the shared database when it exists, otherwise to this browser.
   Reads recipes from window.KM (The Source) and menus from window.KM.menus (Menu Planner). */
(function () {
  'use strict';
  var root = document.getElementById('allergen-root');
  if (!root) return;

  var DAYS = [['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];
  var MEALS = [['lunch', 'Lunch'], ['dinner', 'Dinner']];
  var SECS = [['soup', 'Soup'], ['mains', 'Mains'], ['veg', 'Vegetarian & vegan']];
  var AL = { celery: 'Celery', gluten: 'Gluten', crustaceans: 'Crustaceans', eggs: 'Eggs', fish: 'Fish', lupin: 'Lupin', milk: 'Milk', molluscs: 'Molluscs', mustard: 'Mustard', nuts: 'Tree nuts', peanuts: 'Peanuts', sesame: 'Sesame', soya: 'Soya', sulphites: 'Sulphites' };
  var DIETS = { vegan: 'Vegan', vegetarian: 'Vegetarian', halal: 'Halal' };
  /* Ingredient-name checks for requests that are not one of the 14 allergens. Words in "ex" are ignored before matching. */
  var PRESETS = {
    nightshade: { label: 'Nightshade allergy', kw: 'potato, tomato, aubergine, pepper, chilli, paprika, cayenne, capsicum, goji', ex: 'sweet potato, peppercorn, black pepper, white pepper', sev: 'allergy' },
    redpepper: { label: 'No red peppers', kw: 'red pepper, mixed pepper, peppers', ex: 'green pepper, green peppers, peppercorn', sev: 'preference' },
    custom: { label: 'Other request', kw: '', ex: '', sev: 'preference' }
  };
  var PORK = ['pork', 'gammon', 'bacon', 'chorizo', 'ham', 'sausage', 'pancetta', 'lard', 'pigs', 'gelatine', 'wine', 'beer', 'cider', 'rum', 'brandy', 'sherry'];
  var MEAT = ['chicken', 'turkey', 'beef', 'lamb', 'duck', 'mince'];
  var RANK = { ok: 0, warn: 1, bad: 2 };
  var LS_KEY = 'kitchenmaster.groups.v1', SEED_KEY = 'kitchenmaster.groups.seeded';

  var G = { groups: {}, loaded: false, store: 'loading', week: mondayOf(new Date()), sel: null, tab: 'check', recipes: {}, menus: {}, confirmDel: false };
  var ref = null, dirty = {}, timers = {}, seeded = false;

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(s, o) { return parse(s).toLocaleDateString('en-GB', o); }
  function words(t) { return String(t || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); }
  function re(w) { return new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?([^a-z]|$)'); }
  function hasWord(text, list) { return list.filter(function (w) { return re(w).test(text); }); }
  function mine(g, w) { return g.weekStart === w; }

  /* ---------- data shape ---------- */
  function blankGroup(week) {
    var d = []; for (var i = 0; i < 7; i++) d.push({ lunch: false, dinner: false, dinnerTime: '', notes: '' });
    return { id: uid(), name: 'New group', size: null, weekStart: week, days: d, reqs: [], notes: '' };
  }
  function normGroup(g, id) {
    var o = blankGroup(g && g.weekStart || mondayOf(new Date())); o.id = id;
    if (!g) return o;
    o.name = g.name || 'Group'; o.size = g.size == null ? null : g.size; o.notes = g.notes || '';
    (g.days || []).slice(0, 7).forEach(function (d, i) { d = d || {}; o.days[i] = { lunch: !!d.lunch, dinner: !!d.dinner, dinnerTime: d.dinnerTime || '', notes: d.notes || '' }; });
    o.reqs = (g.reqs || []).map(function (r) {
      return { id: r.id || uid(), type: r.type || 'other', key: r.key || '', label: r.label || '', count: r.count == null ? null : r.count, airborne: !!r.airborne, severity: r.severity === 'preference' ? 'preference' : 'allergy', kw: r.kw || '', ex: r.ex || '' };
    });
    return o;
  }
  function sample() {
    var a = blankGroup('2026-10-12'); a.id = 'sample-a'; a.name = 'Sample: Meridian Training (made up)'; a.size = 24;
    a.notes = 'Made-up group so you can see Allergen Check working. Edit or delete it.';
    a.days[0] = { lunch: false, dinner: true, dinnerTime: '18:30', notes: 'Arrive from 16:00' };
    a.days[1] = { lunch: true, dinner: true, dinnerTime: '19:00', notes: 'Workshops 09:00 to 17:00' };
    a.days[2] = { lunch: true, dinner: true, dinnerTime: '19:00', notes: 'Workshops, evening quiz' };
    a.days[3] = { lunch: true, dinner: false, dinnerTime: '', notes: 'Depart after lunch' };
    a.reqs = [
      { id: 'r1', type: 'allergen', key: 'gluten', label: '', count: 2, airborne: false, severity: 'allergy', kw: '', ex: '' },
      { id: 'r2', type: 'allergen', key: 'peanuts', label: '', count: 1, airborne: true, severity: 'allergy', kw: '', ex: '' },
      { id: 'r3', type: 'diet', key: 'vegan', label: '', count: 2, airborne: false, severity: 'allergy', kw: '', ex: '' },
      { id: 'r4', type: 'diet', key: 'halal', label: '', count: 4, airborne: false, severity: 'allergy', kw: '', ex: '' },
      { id: 'r5', type: 'other', key: 'nightshade', label: PRESETS.nightshade.label, count: 1, airborne: false, severity: 'allergy', kw: PRESETS.nightshade.kw, ex: PRESETS.nightshade.ex },
      { id: 'r6', type: 'other', key: 'redpepper', label: PRESETS.redpepper.label, count: 1, airborne: false, severity: 'preference', kw: PRESETS.redpepper.kw, ex: PRESETS.redpepper.ex }
    ];
    var b = blankGroup('2026-10-12'); b.id = 'sample-b'; b.name = 'Sample: Day visitors (made up)'; b.size = 12;
    b.notes = 'Lunch only, one dairy-free guest.';
    b.days[2] = { lunch: true, dinner: false, dinnerTime: '', notes: 'Lunch 12:30' };
    b.reqs = [{ id: 'r1', type: 'allergen', key: 'milk', label: '', count: 1, airborne: false, severity: 'allergy', kw: '', ex: '' }];
    return [a, b];
  }

  /* ---------- storage ---------- */
  function lsRead() { try { var v = JSON.parse(localStorage.getItem(LS_KEY)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function lsWrite() { try { localStorage.setItem(LS_KEY, JSON.stringify(G.groups)); } catch (e) { } }
  function wasSeeded() { try { return !!localStorage.getItem(SEED_KEY); } catch (e) { return false; } }
  function markSeeded() { try { localStorage.setItem(SEED_KEY, '1'); } catch (e) { } }
  function setStatus(t) { var e = $('#al-status'); if (e) e.textContent = t; }
  function queueSave(id) { dirty[id] = true; clearTimeout(timers[id]); timers[id] = setTimeout(function () { flush(id); }, 400); setStatus('Saving'); }
  function flush(id) {
    var g = G.groups[id]; if (!g) { delete dirty[id]; return; }
    if (G.store === 'db' && ref) { var d = clone(g); delete d.id; ref.doc(id).set(d).then(function () { delete dirty[id]; setStatus('Saved'); }, function () { setStatus('Could not save'); }); }
    else { lsWrite(); delete dirty[id]; setStatus('Saved'); }
  }
  function useLocal() {
    G.store = 'local';
    var saved = lsRead();
    if (saved) Object.keys(saved).forEach(function (k) { G.groups[k] = normGroup(saved[k], k); });
    else if (!wasSeeded()) { sample().forEach(function (g) { G.groups[g.id] = g; }); markSeeded(); lsWrite(); }
    G.loaded = true; render();
  }
  (async function init() {
    var db = null;
    try { db = (window.claude && window.claude.use) ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (!db) { useLocal(); return; }
    G.store = 'db'; ref = db.collection('groups');
    ref.onSnapshot(function (snap) {
      snap.docs.forEach(function (d) { if (!dirty[d.id]) G.groups[d.id] = normGroup(d.data(), d.id); });
      Object.keys(G.groups).forEach(function (k) { if (!dirty[k] && !snap.docs.some(function (d) { return d.id === k; })) delete G.groups[k]; });
      G.loaded = true;
      if (!snap.docs.length && !seeded && !wasSeeded()) { seeded = true; markSeeded(); sample().forEach(function (g) { G.groups[g.id] = g; flush(g.id); }); }
      var a = document.activeElement;
      if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      render();
    }, function () { useLocal(); });
  })();

  /* ---------- data from the other modules ---------- */
  if (window.KM && window.KM.onRecipes) window.KM.onRecipes(function (list) { G.recipes = {}; (list || []).forEach(function (r) { G.recipes[r.id] = r; }); if (G.loaded && !typing()) render(); });
  if (window.KM && window.KM.onMenus) window.KM.onMenus(function (m) { G.menus = m || {}; if (G.loaded && !typing()) render(); });
  function typing() { var a = document.activeElement; return a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }

  /* ---------- the check ---------- */
  function recipeText(r) { return (r.name + ' ' + (r.ingredients || []).map(function (i) { return i.name; }).join(' ')).toLowerCase(); }
  function reqName(q) { return q.type === 'allergen' ? (AL[q.key] || q.key) : q.type === 'diet' ? (DIETS[q.key] || q.key) : (q.label || 'Request'); }
  function evalItem(it, reqs) {
    var notes = [], r = it.recipeId ? G.recipes[it.recipeId] : null;
    function add(level, text) { if (!notes.some(function (n) { return n.text === text; })) notes.push({ level: level, text: text }); }
    if (!r) { add('warn', it.recipeId ? 'Recipe removed from The Source' : 'Custom item, no recipe to check'); return { level: 'warn', notes: notes }; }
    var text = recipeText(r), anyAllergen = false;
    reqs.forEach(function (q) {
      var hard = q.severity === 'allergy', lvl = hard ? 'bad' : 'warn';
      if (q.type === 'allergen') {
        anyAllergen = true; var v = r.allergens && r.allergens[q.key];
        if (v === 'contains') add(lvl, 'Contains ' + reqName(q).toLowerCase() + (q.airborne ? ' (airborne)' : ''));
        else if (v === 'may' && hard) add('warn', 'May contain ' + reqName(q).toLowerCase());
      } else if (q.type === 'diet') {
        var ls = r.additional && r.additional.lifestyle;
        if (q.key === 'vegan' && ls !== 'Vegan') add(lvl, 'Not vegan');
        if (q.key === 'vegetarian' && ls !== 'Vegan' && ls !== 'Vegetarian') add(lvl, 'Not vegetarian');
        if (q.key === 'halal') {
          if (r.proteinType === 'Pork' || hasWord(text, PORK).length) add(lvl, 'Not halal (' + (hasWord(text, PORK)[0] || 'pork') + ')');
          else if (r.proteinType === 'Chicken' || r.proteinType === 'Turkey' || hasWord(text, MEAT).length) add('warn', 'Needs halal-certified meat');
        }
      } else {
        var t = text; words(q.ex).forEach(function (x) { t = t.split(x).join(' '); });
        var hit = hasWord(t, words(q.kw));
        if (hit.length) add(lvl, 'Contains ' + hit[0] + ' (' + reqName(q).toLowerCase() + (hard ? '' : ', preference') + ')');
      }
    });
    if (anyAllergen && !r.allergensChecked) add('warn', 'Allergens not confirmed');
    var worst = 'ok'; notes.forEach(function (n) { if (RANK[n.level] > RANK[worst]) worst = n.level; });
    return { level: worst, notes: notes, recipe: r };
  }
  function menuMeal(g, i, meal) { var w = G.menus[g.weekStart]; return w && w.days && w.days[i] ? w.days[i][meal] : null; }
  function planned(m) { return m && ['soup', 'mains', 'veg'].some(function (s) { return (m[s] || []).length; }); }
  function checkMeal(g, m) {
    var out = { secs: [], cover: [], airborne: [] };
    SECS.forEach(function (s) {
      var rows = (m[s[0]] || []).map(function (it) {
        var e = evalItem(it, g.reqs), sides = (it.sides || []).map(function (sd) { return { it: sd, e: evalItem(sd, g.reqs) }; });
        return { it: it, e: e, sides: sides };
      });
      out.secs.push({ key: s[0], label: s[1], rows: rows });
    });
    /* Per need: is there at least one main or vegetarian dish that is safe for that need on its own? */
    var mainRows = []; out.secs.forEach(function (s) { if (s.key !== 'soup') mainRows = mainRows.concat(s.rows); });
    g.reqs.forEach(function (q) {
      var safe = 0, chk = 0;
      mainRows.forEach(function (r) { var lv = evalItem(r.it, [q]).level; if (lv === 'ok') safe++; else if (lv === 'warn') chk++; });
      out.cover.push({ q: q, safe: safe, chk: chk, total: mainRows.length });
    });
    g.reqs.filter(function (q) { return q.type === 'allergen' && q.airborne; }).forEach(function (q) {
      var where = [];
      out.secs.forEach(function (s) { s.rows.forEach(function (r) { [r].concat(r.sides.map(function (x) { return x; })).forEach(function (x) { if (x.e.recipe && x.e.recipe.allergens && x.e.recipe.allergens[q.key] === 'contains') where.push(x.e.recipe.name); }); }); });
      out.airborne.push({ name: reqName(q), where: where });
    });
    return out;
  }

  /* ---------- views ---------- */
  function badge(level) { return '<span class="sv sv-' + level + '">' + (level === 'ok' ? 'Safe' : level === 'warn' ? 'Check' : 'Not safe') + '</span>'; }
  function noteChips(e) { return e.notes.map(function (n) { return '<span class="ch ' + (n.level === 'bad' ? 'cn' : 'warn') + '">' + esc(n.text) + '</span>'; }).join(''); }
  function rowHTML(it, e, side) {
    var name = e.recipe ? e.recipe.name : it.name;
    return '<li class="ar' + (side ? ' ar-side' : '') + ' ar-' + e.level + '"><div class="ar-main"><span class="pi-name">' + esc(name) + '</span><span class="pi-tags">' + noteChips(e) + '</span></div>' + badge(e.level) + '</li>';
  }
  function mealCard(g, i, meal, label) {
    var d = g.days[i], m = menuMeal(g, i, meal), date = addDays(g.weekStart, i);
    var head = '<div class="meal-head"><h3>' + DAYS[i][0] + ' ' + label + '</h3><span class="lbl">' + fmt(date, { day: 'numeric', month: 'short' }) +
      (meal === 'dinner' && d.dinnerTime ? ' · dinner ' + esc(d.dinnerTime) : '') + (g.size ? ' · ' + g.size + ' guests' : '') + '</span></div>' +
      (d.notes ? '<p class="dim nt">' + esc(d.notes) + '</p>' : '');
    if (!planned(m)) return '<section class="meal acard">' + head + '<p class="dim none">No menu planned for this meal yet. Add dishes in the Menu Planner.</p></section>';
    var c = checkMeal(g, m), body = '';
    if (c.cover.length) body += '<div class="cover" aria-label="Safe mains per need">' + c.cover.map(function (x) {
      var lv = x.safe ? 'ok' : x.chk ? 'warn' : 'bad', t = x.safe ? x.safe + ' safe' : x.chk ? 'check ' + x.chk : 'none safe';
      return '<span class="sv sv-' + lv + '" title="Mains and vegetarian dishes safe for this need on its own">' + esc(reqName(x.q)) + (x.q.count ? ' ×' + x.q.count : '') + ': ' + t + '</span>';
    }).join('') + '</div>';
    c.airborne.forEach(function (a) {
      body += a.where.length ? '<div class="alert alert-warn"><b>Airborne alert: ' + esc(a.name) + '.</b> On this menu in: ' + esc(a.where.join(', ')) + '. Keep away from the guest’s table and prep area.</div>'
        : '<div class="alert alert-ok">Airborne ' + esc(a.name.toLowerCase()) + ': nothing on this menu contains it.</div>';
    });
    c.secs.forEach(function (s) {
      if (!s.rows.length) return;
      body += '<div class="psec"><div class="psec-head"><h4>' + s.label + '</h4></div><ul class="pitems">' + s.rows.map(function (r) {
        return rowHTML(r.it, r.e, false) + r.sides.map(function (x) { return rowHTML(x.it, x.e, true); }).join('');
      }).join('') + '</ul></div>';
    });
    return '<section class="meal acard">' + head + body + '</section>';
  }
  function attended(g) { var out = []; g.days.forEach(function (d, i) { MEALS.forEach(function (m) { if (d[m[0]]) out.push([i, m[0], m[1]]); }); }); return out; }
  function checkHTML(g) {
    if (!g.reqs.length) return '<div class="banner"><span>No dietary needs entered for this group yet.</span><button class="btn" type="button" data-aact="tab" data-t="edit">Add them</button></div>';
    var list = attended(g);
    if (!list.length) return '<div class="banner"><span>Tick which meals this group is here for.</span><button class="btn" type="button" data-aact="tab" data-t="edit">Set the timetable</button></div>';
    var probs = 0, unplanned = 0;
    list.forEach(function (x) { var m = menuMeal(g, x[0], x[1]); if (!planned(m)) unplanned++; else { var c = checkMeal(g, m); if (c.cover.some(function (x) { return !x.safe && !x.chk; })) probs++; } });
    var sum = '<div class="asum">' + (probs ? '<span class="sv sv-bad">' + probs + (probs === 1 ? ' meal has' : ' meals have') + ' a need with no safe main</span>' : '<span class="sv sv-ok">Every planned meal covers every need</span>') +
      (unplanned ? '<span class="sv sv-warn">' + unplanned + ' not planned yet</span>' : '') + '</div>';
    return sum + '<div class="acards">' + list.map(function (x) { return mealCard(g, x[0], x[1], x[2]); }).join('') + '</div>';
  }
  function reqRow(q) {
    var o = '<li class="req" data-rid="' + esc(q.id) + '"><div class="req-grid">';
    o += '<label class="fld"><span>Type</span><select data-f="type"><option value="allergen"' + (q.type === 'allergen' ? ' selected' : '') + '>Allergen</option><option value="diet"' + (q.type === 'diet' ? ' selected' : '') + '>Diet</option><option value="other"' + (q.type === 'other' ? ' selected' : '') + '>Other request</option></select></label>';
    var opts;
    if (q.type === 'allergen') opts = Object.keys(AL).map(function (k) { return [k, AL[k]]; });
    else if (q.type === 'diet') opts = Object.keys(DIETS).map(function (k) { return [k, DIETS[k]]; });
    else opts = [['nightshade', 'Nightshade allergy'], ['redpepper', 'No red peppers'], ['custom', 'Custom']];
    o += '<label class="fld"><span>' + (q.type === 'other' ? 'Preset' : q.type === 'diet' ? 'Diet' : 'Allergen') + '</span><select data-f="key">' + opts.map(function (p) { return '<option value="' + p[0] + '"' + (q.key === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label>';
    o += '<label class="fld"><span>People</span><input data-f="count" inputmode="numeric" value="' + (q.count == null ? '' : q.count) + '" placeholder="0"></label>';
    o += '<label class="fld"><span>Level</span><select data-f="severity"><option value="allergy"' + (q.severity === 'allergy' ? ' selected' : '') + '>Must avoid</option><option value="preference"' + (q.severity === 'preference' ? ' selected' : '') + '>Preference</option></select></label>';
    if (q.type === 'allergen') o += '<label class="chk"><input type="checkbox" data-f="airborne"' + (q.airborne ? ' checked' : '') + '><span>Airborne risk</span></label>';
    o += '<button class="icon-btn rmi" type="button" data-aact="rm-req" aria-label="Remove requirement">×</button></div>';
    if (q.type === 'other') {
      o += '<div class="req-grid2"><label class="fld"><span>Name</span><input data-f="label" value="' + esc(q.label) + '"></label>' +
        '<label class="fld"><span>Flag if an ingredient contains (comma separated)</span><input data-f="kw" value="' + esc(q.kw) + '"></label>' +
        '<label class="fld"><span>Ignore these words</span><input data-f="ex" value="' + esc(q.ex) + '"></label></div>';
    }
    return o + '</li>';
  }
  function editHTML(g) {
    var rows = g.days.map(function (d, i) {
      return '<tr data-day="' + i + '"><th scope="row">' + DAYS[i][0] + ' <small>' + fmt(addDays(g.weekStart, i), { day: 'numeric', month: 'short' }) + '</small></th>' +
        '<td><label class="chk"><input type="checkbox" data-d="lunch"' + (d.lunch ? ' checked' : '') + '><span>Lunch</span></label></td>' +
        '<td><label class="chk"><input type="checkbox" data-d="dinner"' + (d.dinner ? ' checked' : '') + '><span>Dinner</span></label></td>' +
        '<td><input data-d="dinnerTime" value="' + esc(d.dinnerTime) + '" placeholder="Dinner time" aria-label="Dinner time ' + DAYS[i][1] + '"></td>' +
        '<td><input data-d="notes" value="' + esc(d.notes) + '" placeholder="Events, arrival, departure" aria-label="Notes ' + DAYS[i][1] + '"></td></tr>';
    }).join('');
    return '<div class="aedit"><div class="agrid"><label class="fld"><span>Group name</span><input data-g="name" value="' + esc(g.name) + '"></label>' +
      '<label class="fld"><span>Guests</span><input data-g="size" inputmode="numeric" value="' + (g.size == null ? '' : g.size) + '" placeholder="0"></label></div>' +
      '<h3 class="ah">Timetable</h3><p class="dim">Tick the meals this group is here for. A group that spans two weeks needs one entry per week.</p>' +
      '<div class="tt-wrap"><table class="tt"><tbody>' + rows + '</tbody></table></div>' +
      '<h3 class="ah">Dietary needs and requests</h3>' +
      (g.reqs.length ? '<ul class="reqs">' + g.reqs.map(reqRow).join('') + '</ul>' : '<p class="dim none">Nothing added yet.</p>') +
      '<div class="addrow"><button class="btn" type="button" data-aact="add" data-t="allergen">+ Allergen</button><button class="btn" type="button" data-aact="add" data-t="diet">+ Diet (vegan, halal…)</button><button class="btn" type="button" data-aact="add" data-t="other">+ Other request</button></div>' +
      '<label class="fld"><span>Notes</span><textarea data-g="notes" rows="2">' + esc(g.notes) + '</textarea></label>' +
      '<div class="addrow">' + (G.confirmDel ? '<button class="btn danger" type="button" data-aact="del-yes">Yes, delete this group</button><button class="btn" type="button" data-aact="del-no">Keep it</button>' : '<button class="btn ghost-danger" type="button" data-aact="del">Delete group</button>') + '</div></div>';
  }
  function render() {
    if (!G.loaded) { root.innerHTML = '<div class="empty"><h2>Loading groups</h2><p>Fetching Allergen Check.</p></div>'; return; }
    var list = Object.keys(G.groups).map(function (k) { return G.groups[k]; }).filter(function (g) { return mine(g, G.week); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!G.sel || !G.groups[G.sel] || !mine(G.groups[G.sel], G.week)) G.sel = list.length ? list[0].id : null;
    var g = G.sel ? G.groups[G.sel] : null;
    var chips = list.map(function (x) { return '<button class="gtab" type="button" data-aact="sel" data-id="' + esc(x.id) + '" aria-selected="' + (x.id === G.sel) + '">' + esc(x.name) + (x.size ? ' <small>' + x.size + '</small>' : '') + '</button>'; }).join('');
    root.innerHTML =
      '<div class="weeknav"><div class="wn-l"><button class="icon-btn" type="button" data-aact="wk-prev" aria-label="Previous week">‹</button>' +
      '<div class="wn-t"><b>Week of ' + fmt(G.week, { day: 'numeric', month: 'long', year: 'numeric' }) + '</b></div>' +
      '<button class="icon-btn" type="button" data-aact="wk-next" aria-label="Next week">›</button></div>' +
      '<div class="wn-r"><button class="btn" type="button" data-aact="wk-today">This week</button><button class="btn" type="button" data-aact="print">Print</button><span class="tot" id="al-status" role="status"></span></div></div>' +
      '<div class="gtabs" role="tablist" aria-label="Groups">' + chips + '<button class="btn primary" type="button" data-aact="new">+ New group</button></div>' +
      (g ? '<div class="subtabs" role="tablist"><button class="dtab stab" type="button" data-aact="tab" data-t="check" aria-selected="' + (G.tab === 'check') + '">Menu check</button><button class="dtab stab" type="button" data-aact="tab" data-t="edit" aria-selected="' + (G.tab === 'edit') + '">Group details</button></div>' +
        '<h2 class="dayhead">' + esc(g.name) + '</h2>' + (G.tab === 'check' ? checkHTML(g) : editHTML(g))
        : '<div class="empty"><h2>No groups this week</h2><p>Add a group, tick the meals they are here for and enter their dietary needs. Kitchen Master checks every dish on the menu against them.</p><button class="btn primary" type="button" data-aact="new">+ New group</button></div>');
  }

  /* ---------- events ---------- */
  function edit(fn) { var g = G.groups[G.sel]; if (!g) return; fn(g); queueSave(g.id); }
  function numv(v) { v = String(v || '').trim(); if (v === '') return null; var n = parseInt(v, 10); return isFinite(n) && n >= 0 ? n : null; }
  function reqOf(g, el) { var li = el.closest('[data-rid]'); return li ? g.reqs.filter(function (r) { return r.id === li.dataset.rid; })[0] : null; }
  function applyPreset(q) { var p = PRESETS[q.key]; if (p) { q.label = p.label; q.kw = p.kw; q.ex = p.ex; q.severity = p.sev; } }
  root.addEventListener('input', function (e) {
    var t = e.target; if (t.type === 'checkbox' || t.tagName === 'SELECT') return;
    if (t.dataset.g) edit(function (g) { g[t.dataset.g] = t.dataset.g === 'size' ? numv(t.value) : t.value; });
    else if (t.dataset.d) edit(function (g) { g.days[+t.closest('[data-day]').dataset.day][t.dataset.d] = t.value; });
    else if (t.dataset.f) edit(function (g) { var q = reqOf(g, t); if (q) q[t.dataset.f] = t.dataset.f === 'count' ? numv(t.value) : t.value; });
  });
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.d && t.type === 'checkbox') { edit(function (g) { g.days[+t.closest('[data-day]').dataset.day][t.dataset.d] = t.checked; }); return; }
    if (t.dataset.f && (t.type === 'checkbox' || t.tagName === 'SELECT')) {
      edit(function (g) {
        var q = reqOf(g, t); if (!q) return;
        if (t.type === 'checkbox') q[t.dataset.f] = t.checked;
        else if (t.dataset.f === 'type') { q.type = t.value; q.key = t.value === 'allergen' ? 'gluten' : t.value === 'diet' ? 'vegan' : 'custom'; q.airborne = false; q.severity = 'allergy'; if (q.type === 'other') { applyPreset(q); } else { q.label = ''; q.kw = ''; q.ex = ''; } }
        else if (t.dataset.f === 'key') { q.key = t.value; if (q.type === 'other') applyPreset(q); }
        else q[t.dataset.f] = t.value;
      });
      render();
    }
  });
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-aact]'); if (!t) return;
    var a = t.dataset.aact;
    switch (a) {
      case 'wk-prev': G.week = addDays(G.week, -7); G.confirmDel = false; render(); break;
      case 'wk-next': G.week = addDays(G.week, 7); G.confirmDel = false; render(); break;
      case 'wk-today': G.week = mondayOf(new Date()); G.confirmDel = false; render(); break;
      case 'print': window.print(); break;
      case 'sel': G.sel = t.dataset.id; G.confirmDel = false; render(); break;
      case 'tab': G.tab = t.dataset.t; G.confirmDel = false; render(); break;
      case 'new': var n = blankGroup(G.week); G.groups[n.id] = n; G.sel = n.id; G.tab = 'edit'; queueSave(n.id); render(); var f = $('[data-g="name"]'); if (f) { f.focus(); f.select(); } break;
      case 'add':
        edit(function (g) {
          var q = { id: uid(), type: t.dataset.t, key: t.dataset.t === 'allergen' ? 'gluten' : t.dataset.t === 'diet' ? 'vegan' : 'nightshade', label: '', count: null, airborne: false, severity: 'allergy', kw: '', ex: '' };
          if (q.type === 'other') applyPreset(q);
          g.reqs.push(q);
        }); render(); break;
      case 'rm-req': edit(function (g) { var q = reqOf(g, t); g.reqs = g.reqs.filter(function (r) { return r !== q; }); }); render(); break;
      case 'del': G.confirmDel = true; render(); break;
      case 'del-no': G.confirmDel = false; render(); break;
      case 'del-yes':
        var id = G.sel; delete G.groups[id]; delete dirty[id]; G.sel = null; G.confirmDel = false; G.tab = 'check';
        if (G.store === 'db' && ref) ref.doc(id).delete().then(function () { }, function () { }); else lsWrite();
        render(); break;
    }
  });
  window.addEventListener('beforeunload', function () { Object.keys(dirty).forEach(function (k) { if (G.store !== 'db') flush(k); }); });
})();
