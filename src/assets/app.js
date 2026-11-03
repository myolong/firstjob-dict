(function () {
  var q = document.getElementById('q');
  var rows = Array.prototype.slice.call(document.querySelectorAll('#food-table tbody tr'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var empty = document.getElementById('empty');
  var cat = '';

  function norm(s) { return s.replace(/\s+/g, '').toLowerCase(); }

  function apply() {
    var term = norm(q.value);
    var shown = 0;
    rows.forEach(function (tr) {
      var tokens = norm(tr.dataset.name).split('|');
      var hit = !term || (/^\d{1,2}월$/.test(term)
        ? tokens.indexOf(term) !== -1
        : tokens.some(function (t) { return t.indexOf(term) !== -1; }));
      var ok = (!cat || tr.dataset.cat === cat) && hit;
      tr.hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown !== 0;
  }

  q.addEventListener('input', apply);
  // 홈 통합 검색에서 넘어온 검색어 (?q=)
  var pre = new URLSearchParams(location.search).get('q');
  if (pre) { q.value = pre; apply(); }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      cat = c.dataset.cat;
      chips.forEach(function (x) { x.classList.toggle('is-on', x === c); });
      apply();
    });
  });
})();
