(function () {
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // 전체 메뉴 통합 검색
  var q = document.getElementById('gq');
  var list = document.getElementById('gresults');
  var empty = document.getElementById('gempty');
  var index = null, loading = false;
  function norm(s) { return s.replace(/\s+/g, '').toLowerCase(); }
  function load() {
    if (index || loading) return;
    loading = true;
    fetch(q.dataset.index).then(function (r) { return r.json(); }).then(function (rows) {
      index = rows.map(function (r) { r.t = [r.n].concat(r.k).map(norm); return r; });
      render();
    }).catch(function () { loading = false; });
  }
  function render() {
    var term = norm(q.value);
    if (!term || !index) { list.hidden = true; empty.hidden = true; return; }
    var month = /^\d{1,2}월$/.test(term);
    var hits = index.filter(function (r) {
      return month ? r.t.indexOf(term) !== -1 : r.t.some(function (t) { return t.indexOf(term) !== -1; });
    });
    hits.sort(function (a, b) { return (norm(a.n).indexOf(term) === 0 ? 0 : 1) - (norm(b.n).indexOf(term) === 0 ? 0 : 1); });
    list.innerHTML = hits.slice(0, 8).map(function (r) {
      return '<li><a href="' + esc(r.u) + '"><strong>' + esc(r.n) + '</strong><span class="where">' + esc(r.s) +
        '</span><span class="what">' + esc(r.d) + '</span></a></li>';
    }).join('');
    list.hidden = hits.length === 0;
    empty.hidden = hits.length !== 0;
  }
  q.addEventListener('focus', load);
  q.addEventListener('input', function () { load(); render(); });
})();
