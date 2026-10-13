/* Kitchen Master module navigation. Shows one module at a time and remembers the last one. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  function $(s, r) { return (r || document).querySelector(s); }
  var MOD_KEY = 'kitchenmaster.module';
  var MODS = ['source', 'planner', 'allergens', 'stock', 'waste', 'order'];
  function showModule(name, remember) {
    if (MODS.indexOf(name) < 0) name = 'source';
    MODS.forEach(function (m) { var s = $('#mod-' + m); if (s) s.hidden = m !== name; });
    document.querySelectorAll('#nav .tab').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.mod === name ? 'true' : 'false'); });
    if (remember) { try { localStorage.setItem(MOD_KEY, name); } catch (x) { } }
  }
  $('#nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mod]'); if (b) { showModule(b.dataset.mod, true); window.scrollTo(0, 0); }
  });
  (function () { var m = 'source'; try { m = localStorage.getItem(MOD_KEY) || 'source'; } catch (x) { } showModule(m, false); })();
})();
