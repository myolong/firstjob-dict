/* 첫직장사전 계산기 (2026년 기준).
   요율·기준이 바뀌면 아래 R 값만 고친다. */
(function () {
  var R = {
    year: 2026,
    pension: 0.0475,            // 국민연금 근로자 부담 (총 9.5%)
    pensionMin: 410000,         // 기준소득월액 하한 (2026.7~2027.6)
    pensionMax: 6590000,        // 기준소득월액 상한 (2026.7~2027.6)
    health: 0.03595,            // 건강보험 근로자 부담 (총 7.19%)
    care: 0.9448 / 7.19,        // 장기요양 = 건강보험료 × (0.9448% / 7.19%)
    employ: 0.009,              // 고용보험 근로자 부담
    minWage: 10320,             // 2026 최저임금 (시간)
    ubMax: 68100,               // 구직급여 1일 상한 (2026.1.1 이후 이직자)
    ubMinRate: 0.8              // 구직급여 하한 = 최저임금 × 80% × 1일 소정근로시간(최대 8)
  };

  function $(id) { return document.getElementById(id); }
  function num(id) {
    var el = $(id);
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(/[^\d.]/g, ''));
    return isNaN(v) ? 0 : v;
  }
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function floor10(n) { return Math.floor(n / 10) * 10; }
  function rows(list) {
    return '<table class="rows"><tbody>' + list.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function bind(form, fn) {
    if (!form) return;
    form.addEventListener('input', fn);
    form.addEventListener('change', fn);
    fn();
  }
  // 숫자 입력칸에 천 단위 쉼표
  Array.prototype.forEach.call(document.querySelectorAll('.calc input[data-money]'), function (el) {
    el.addEventListener('input', function () {
      var raw = el.value.replace(/[^\d]/g, '');
      el.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
    });
  });

  /* ── 소득세 (근로소득 간이세액 추정) ───────────────────────── */
  function earnedDeduction(t) {
    var d;
    if (t <= 5e6) d = t * 0.7;
    else if (t <= 15e6) d = 3.5e6 + (t - 5e6) * 0.4;
    else if (t <= 45e6) d = 7.5e6 + (t - 15e6) * 0.15;
    else if (t <= 1e8) d = 12e6 + (t - 45e6) * 0.05;
    else d = 14.75e6 + (t - 1e8) * 0.02;
    return Math.min(d, 2e7);
  }
  // 간이세액표 작성 기준의 '특별소득공제 등' (공제대상가족 수별)
  function specialDeduction(t, fam) {
    var base = fam >= 3 ? 5e6 : fam === 2 ? 3.6e6 : 3.1e6;
    var d;
    if (fam >= 3) {
      if (t <= 3e7) d = base + t * 0.07;
      else if (t <= 4.5e7) d = base + t * 0.07 - (t - 3e7) * 0.05;
      else if (t <= 7e7) d = base + t * 0.05;
      else if (t <= 1.2e8) d = base + t * 0.03;
      else d = base + t * 0.03;
      if (t > 4e7) d += (t - 4e7) * 0.04;
    } else {
      var hi = fam === 2 ? [0.02, 0.01] : [0.015, 0.005];
      if (t <= 3e7) d = base + t * 0.04;
      else if (t <= 4.5e7) d = base + t * 0.04 - (t - 3e7) * 0.05;
      else if (t <= 7e7) d = base + t * hi[0];
      else d = base + t * hi[1];
    }
    return Math.max(d, 0);
  }
  function basicTax(x) {
    var b = [[14e6, 0.06, 0], [5e7, 0.15, 1.26e6], [8.8e7, 0.24, 5.76e6], [1.5e8, 0.35, 15.44e6],
      [3e8, 0.38, 19.94e6], [5e8, 0.40, 25.94e6], [1e9, 0.42, 35.94e6], [Infinity, 0.45, 65.94e6]];
    for (var i = 0; i < b.length; i++) if (x <= b[i][0]) return Math.max(x * b[i][1] - b[i][2], 0);
  }
  function earnedTaxCredit(tax, t) {
    var c = tax <= 1.3e6 ? tax * 0.55 : 715000 + (tax - 1.3e6) * 0.3;
    var lim;
    if (t <= 3.3e7) lim = 740000;
    else if (t <= 7e7) lim = Math.max(740000 - (t - 3.3e7) * 0.008, 660000);
    else if (t <= 1.2e8) lim = Math.max(660000 - (t - 7e7) * 0.5, 500000);
    else lim = Math.max(500000 - (t - 1.2e8) * 0.5, 200000);
    return Math.min(c, lim);
  }
  function childCredit(kids) {   // 간이세액표의 8~20세 자녀 월 공제액
    if (kids <= 0) return 0;
    if (kids === 1) return 20830;
    if (kids === 2) return 45830;
    return 45830 + (kids - 2) * 33330;
  }
  function monthlyIncomeTax(taxable, fam, kids) {
    var t = taxable * 12;
    var pensionYear = Math.min(Math.max(taxable, R.pensionMin), R.pensionMax) * R.pension * 12;
    var base = t - earnedDeduction(t) - 1.5e6 * fam - pensionYear - specialDeduction(t, fam);
    var tax = basicTax(Math.max(base, 0));
    tax = Math.max(tax - earnedTaxCredit(tax, t), 0);
    var m = floor10(tax / 12 - childCredit(kids));
    return Math.max(m, 0);
  }
  function deductions(monthly, nontax, fam, kids) {
    var taxable = Math.max(monthly - nontax, 0);
    var p = floor10(Math.min(Math.max(taxable, R.pensionMin), R.pensionMax) * R.pension);
    if (taxable === 0) p = 0;
    var h = floor10(taxable * R.health);
    var c = floor10(h * R.care);
    var e = floor10(taxable * R.employ);
    var it = monthlyIncomeTax(taxable, fam, kids);
    var lt = floor10(it * 0.1);
    return { taxable: taxable, p: p, h: h, c: c, e: e, it: it, lt: lt, total: p + h + c + e + it + lt };
  }

  /* ── 1. 실수령액 ────────────────────────────────────────── */
  (function () {
    var f = $('calc-takehome');
    if (!f) return;
    var mode = 'year';
    Array.prototype.forEach.call(f.querySelectorAll('.seg button'), function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        Array.prototype.forEach.call(f.querySelectorAll('.seg button'), function (x) { x.classList.toggle('is-on', x === b); });
        $('th-pay-label').textContent = mode === 'year' ? '연봉 (세전, 퇴직금 제외)' : '월급 (세전)';
        run();
      });
    });
    function run() {
      var pay = num('th-pay');
      var monthly = mode === 'year' ? pay / 12 : pay;
      var nontax = num('th-nontax');
      var fam = Math.max(1, Math.round(num('th-fam')) || 1);
      var kids = Math.round(num('th-kids'));
      if (!monthly) { $('th-out').innerHTML = '<p class="note">금액을 입력하면 바로 계산됩니다.</p>'; return; }
      var d = deductions(monthly, nontax, fam, kids);
      var net = monthly - d.total;
      $('th-out').innerHTML =
        '<p class="big">' + won(net) + '<small>한 달 예상 실수령액</small></p>' +
        '<p class="note">연 환산 ' + won(net * 12) + ' · 공제 합계 월 ' + won(d.total) + '</p>' +
        rows([
          ['세전 월급', won(monthly)],
          ['국민연금 (4.75%)', won(d.p)],
          ['건강보험 (3.595%)', won(d.h)],
          ['장기요양보험 (건강보험료의 13.14%)', won(d.c)],
          ['고용보험 (0.9%)', won(d.e)],
          ['소득세 (간이세액 추정)', won(d.it)],
          ['지방소득세 (소득세의 10%)', won(d.lt)]
        ]) +
        (monthly < R.minWage * 209 && mode === 'month' ? '<p class="warn">입력한 월급이 2026년 최저임금 월 환산액(209시간 기준 ' + won(R.minWage * 209) + ')보다 적습니다.</p>' : '');
    }
    bind(f, run);
  })();

  /* ── 2. 연봉·월급·시급 환산 ─────────────────────────────── */
  (function () {
    var f = $('calc-convert');
    if (!f) return;
    function run() {
      var kind = $('cv-kind').value;
      var v = num('cv-amount');
      var hours = num('cv-hours') || 209;
      var year, month, hour;
      if (kind === 'year') { year = v; month = v / 12; hour = month / hours; }
      else if (kind === 'month') { month = v; year = v * 12; hour = v / hours; }
      else { hour = v; month = v * hours; year = month * 12; }
      if (!v) { $('cv-out').innerHTML = '<p class="note">금액을 입력하면 바로 계산됩니다.</p>'; return; }
      $('cv-out').innerHTML = rows([
        ['연봉', '<b>' + won(year) + '</b>'],
        ['월급', '<b>' + won(month) + '</b>'],
        ['시급 (월 ' + hours + '시간 기준)', '<b>' + won(hour) + '</b>']
      ]) + (hour < R.minWage ? '<p class="warn">2026년 최저임금 시급 ' + won(R.minWage) + '보다 낮습니다. 수습 3개월 감액(90%)이나 근로시간 설정을 확인해 보세요.</p>' : '<p class="note">2026년 최저임금 ' + won(R.minWage) + ' 이상입니다.</p>');
    }
    bind(f, run);
  })();

  /* ── 3. 퇴직금 ─────────────────────────────────────────── */
  (function () {
    var f = $('calc-severance');
    if (!f) return;
    function d(id) { var v = $(id).value; return v ? new Date(v + 'T00:00:00') : null; }
    function run() {
      var s = d('sv-start'), e = d('sv-end');
      var pay = num('sv-pay'), bonus = num('sv-bonus'), leave = num('sv-leave');
      if (!s || !e || !pay) { $('sv-out').innerHTML = '<p class="note">입사일, 마지막 근무일, 월급을 넣으면 계산됩니다.</p>'; return; }
      var quit = new Date(e.getTime()); quit.setDate(quit.getDate() + 1);    // 퇴직일 = 마지막 근무일 다음 날
      var days = Math.round((quit - s) / 864e5);
      if (days <= 0) { $('sv-out').innerHTML = '<p class="warn">날짜를 다시 확인해 주세요.</p>'; return; }
      var from = new Date(quit.getTime()); from.setMonth(from.getMonth() - 3);
      var period = Math.round((quit - from) / 864e5);
      var wage3 = pay * 3 + bonus * 3 / 12 + leave * 3 / 12;
      var avg = wage3 / period;
      var sev = avg * 30 * days / 365;
      var html = '<p class="big">' + won(sev) + '<small>예상 퇴직금 (세전)</small></p>' + rows([
        ['재직일수', days.toLocaleString('ko-KR') + '일'],
        ['퇴직 전 3개월 일수', period + '일'],
        ['3개월 임금 총액 (상여·연차수당 3/12 포함)', won(wage3)],
        ['1일 평균임금', won(avg)]
      ]);
      if (days < 365) html += '<p class="warn">계속근로기간이 1년 미만이면 법정 퇴직금이 생기지 않습니다.</p>';
      $('sv-out').innerHTML = html;
    }
    bind(f, run);
  })();

  /* ── 4. 실업급여 ───────────────────────────────────────── */
  (function () {
    var f = $('calc-ub');
    if (!f) return;
    var TABLE = { under50: [120, 150, 180, 210, 240], over50: [120, 180, 210, 240, 270] };
    function run() {
      var pay = num('ub-pay');
      var hours = Math.min(num('ub-hours') || 8, 8);
      var age = $('ub-age').value;
      var span = Number($('ub-span').value);
      if (!pay) { $('ub-out').innerHTML = '<p class="note">퇴직 전 월급을 넣으면 계산됩니다.</p>'; return; }
      var avg = pay * 3 / 91;  // 퇴직 전 3개월(약 91일) 기준 1일 평균임금
      var raw = avg * 0.6;
      var min = R.minWage * R.ubMinRate * hours;
      var daily = Math.min(Math.max(raw, min), R.ubMax);
      var n = TABLE[age][span];
      var why = raw > R.ubMax ? ' (상한액 적용)' : raw < min ? ' (하한액 적용)' : '';
      $('ub-out').innerHTML = '<p class="big">' + won(daily * n) + '<small>총 예상 수급액</small></p>' + rows([
        ['1일 구직급여' + why, won(daily)],
        ['받을 수 있는 날 (소정급여일수)', n + '일'],
        ['한 달(30일) 기준', won(daily * 30)],
        ['2026년 1일 상한 / 하한', won(R.ubMax) + ' / ' + won(min)]
      ]);
    }
    bind(f, run);
  })();

  /* ── 5. 연차 ───────────────────────────────────────────── */
  (function () {
    var f = $('calc-leave');
    if (!f) return;
    function run() {
      var sv = $('lv-start').value, bv = $('lv-base').value;
      if (!sv) { $('lv-out').innerHTML = '<p class="note">입사일을 넣으면 계산됩니다.</p>'; return; }
      var s = new Date(sv + 'T00:00:00');
      var b = bv ? new Date(bv + 'T00:00:00') : new Date();
      var months = (b.getFullYear() - s.getFullYear()) * 12 + (b.getMonth() - s.getMonth()) - (b.getDate() < s.getDate() ? 1 : 0);
      if (months < 0) { $('lv-out').innerHTML = '<p class="warn">기준일이 입사일보다 빠릅니다.</p>'; return; }
      var years = Math.floor(months / 12), html;
      if (years < 1) {
        var n = Math.min(months, 11);
        html = '<p class="big">' + n + '일<small>지금까지 생긴 연차 (1년 미만, 매달 1일)</small></p>' +
          '<p class="note">입사 1년이 될 때까지 한 달 개근할 때마다 1일씩, 최대 11일이 생깁니다. 1년을 채우고 출근율이 80% 이상이면 15일이 새로 생깁니다.</p>';
      } else {
        var add = Math.floor((years - 1) / 2);
        var total = Math.min(15 + add, 25);
        html = '<p class="big">' + total + '일<small>올해 연차 (근속 ' + years + '년차 기준)</small></p>' +
          rows([['기본 연차', '15일'], ['근속 가산 (2년마다 1일, 최대 25일)', add + '일']]) +
          '<p class="note">직전 1년 출근율이 80% 이상일 때 기준입니다. 회계연도(1월 1일) 기준으로 주는 회사는 숫자가 다를 수 있습니다.</p>';
      }
      $('lv-out').innerHTML = html;
    }
    bind(f, run);
  })();

  /* ── 6. 주휴수당 ───────────────────────────────────────── */
  (function () {
    var f = $('calc-weekly');
    if (!f) return;
    function run() {
      var wage = num('wk-wage') || R.minWage;
      var h = num('wk-hours');
      if (!h) { $('wk-out').innerHTML = '<p class="note">일주일 근무시간을 넣으면 계산됩니다.</p>'; return; }
      if (h < 15) { $('wk-out').innerHTML = '<p class="big">0원<small>주 15시간 미만</small></p><p class="note">1주 소정근로시간이 15시간 미만이면 주휴수당이 없습니다.</p>'; return; }
      var hol = Math.min(h / 40 * 8, 8);
      var pay = hol * wage;
      $('wk-out').innerHTML = '<p class="big">' + won(pay) + '<small>1주 주휴수당</small></p>' + rows([
        ['주휴시간', (Math.round(hol * 100) / 100) + '시간'],
        ['한 달 (4.345주) 주휴수당', won(pay * 4.345)],
        ['주휴 포함 1주 총급여', won(h * wage + pay)]
      ]) + '<p class="note">약속한 근무일을 모두 출근하고 다음 주에도 근무가 예정되어 있을 때 받을 수 있습니다.</p>';
    }
    bind(f, run);
  })();
  /* ── 7. 자동차 할부 ────────────────────────────────────── */
  function monthlyPay(principal, ratePct, months) {
    var r = ratePct / 100 / 12;
    if (months <= 0) return 0;
    if (r === 0) return principal / months;
    return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  }
  (function () {
    var f = $('calc-carloan');
    if (!f) return;
    function run() {
      var price = num('cl-price'), down = num('cl-down'), rate = num('cl-rate'), months = Math.round(num('cl-months'));
      var principal = Math.max(price - down, 0);
      if (!price || !months) { $('cl-out').innerHTML = '<p class="note">차량 가격과 할부 기간을 넣으면 계산됩니다.</p>'; return; }
      var m = monthlyPay(principal, rate, months);
      var interest = m * months - principal;
      $('cl-out').innerHTML = '<p class="big">' + won(m) + '<small>한 달 할부금 (원리금균등)</small></p>' + rows([
        ['할부 원금 (차량 가격 − 선수금)', won(principal)],
        ['총 이자', won(interest)],
        ['총 납입액 (선수금 포함)', won(down + m * months)],
        ['차량 가격 대비 이자 비율', (principal ? Math.round(interest / price * 1000) / 10 : 0) + '%']
      ]) + '<p class="note">취득세·보험료·탁송료는 포함되지 않은 금액입니다.</p>';
    }
    bind(f, run);
  })();

  /* ── 8. 할부·리스·장기렌트 총비용 비교 ─────────────────── */
  (function () {
    var f = $('calc-carcompare');
    if (!f) return;
    function run() {
      var price = num('cc-price'), months = Math.round(num('cc-months')) || 48, years = months / 12;
      var rate = num('cc-rate'), down = num('cc-down'), ins = num('cc-ins');
      var lease = num('cc-lease'), rent = num('cc-rent'), resid = num('cc-resid') / 100;
      if (!price) { $('cc-out').innerHTML = '<p class="note">차량 가격을 넣으면 계산됩니다.</p>'; return; }
      var tax = Math.round(price / 1.1 * 0.07);   // 비영업용 승용차 취득세 7% (부가세 제외 가격 기준, 추정)
      var loanM = monthlyPay(Math.max(price - down, 0), rate, months);
      var loanOut = down + loanM * months + tax + ins * years;
      var value = price * resid;
      var leaseOut = lease * months + ins * years;
      var rentOut = rent * months;
      function line(name, out, note) { return '<tr><td>' + name + '<span class="hint">' + note + '</span></td><td>' + won(out) + '</td></tr>'; }
      var html = '<table class="rows"><tbody>' +
        line('할부 (내 차)', loanOut, '선수금 + 할부금 + 취득세 + 보험료') +
        line('할부 − 기간 끝 차량 가치', loanOut - value, '차를 팔면 돌려받는 돈(잔존가치 ' + Math.round(resid * 100) + '%)을 뺀 실제 비용') +
        (lease ? line('리스 (반납 기준)', leaseOut, '월 리스료 + 보험료 (보험은 본인 가입)') : '') +
        (rent ? line('장기렌트 (반납 기준)', rentOut, '월 대여료 (보험·세금 포함)') : '') +
        '</tbody></table>';
      html += '<p class="note">' + months + '개월 기준. 리스·렌트의 보증금·선납금, 정비 포함 여부, 약정 주행거리 초과 요금은 견적마다 달라 넣지 않았습니다. 실제 견적서 금액으로 바꿔 넣어 비교하세요.</p>';
      $('cc-out').innerHTML = html;
    }
    bind(f, run);
  })();

  /* ── 9. 연봉별 적정 차량 가격 ─────────────────────────── */
  (function () {
    var f = $('calc-carbudget');
    if (!f) return;
    function run() {
      var salary = num('cb-salary'), cash = num('cb-cash'), other = num('cb-other');
      if (!salary) { $('cb-out').innerHTML = '<p class="note">연봉을 넣으면 계산됩니다.</p>'; return; }
      var d = deductions(salary / 12, 200000, 1, 0);
      var net = salary / 12 - d.total;
      var carMonthly = net * 0.15 - other;         // 차에 쓰는 돈(할부+보험+기름값+주차) 월 실수령의 15% 이내
      var running = 250000;                          // 보험·유류·주차 등 월 유지비 가정
      var payCap = Math.max(carMonthly - running, 0);
      var loanable = payCap * 48;                    // 금리 무시 48개월 단순 계산
      var byRule = salary * 0.5;
      var byCash = cash + loanable;
      var pick = Math.min(byRule, byCash);
      $('cb-out').innerHTML = '<p class="big">' + won(Math.floor(pick / 1e6) * 1e6) + '<small>이하 차량을 권장</small></p>' + rows([
        ['월 예상 실수령액', won(net)],
        ['차에 쓸 수 있는 돈 (실수령의 15% − 다른 대출 상환액)', won(Math.max(carMonthly, 0))],
        ['그중 할부에 쓸 수 있는 돈 (유지비 월 25만원 가정)', won(payCap)],
        ['기준 ① 연봉의 50%', won(byRule)],
        ['기준 ② 모은 돈 + 48개월 할부 가능액', won(byCash)]
      ]) + '<p class="note">두 기준 중 낮은 금액을 권장 상한으로 보여 줍니다. 개인 재무 관리에서 흔히 쓰이는 어림 기준이며, 정답은 아닙니다.</p>';
    }
    bind(f, run);
  })();
  /* ── 10. 자동차 취득세 ───────────────────────────────── */
  (function () {
    var f = $('calc-acqtax');
    if (!f) return;
    // 지방세법 제12조, 지방세특례제한법 제66조·제67조 (2026.11 시행 기준)
    var TYPES = {
      car:    { name: '일반 승용차', rate: 0.07, cut: 0 },
      hybrid: { name: '하이브리드', rate: 0.07, cut: 0, note: '하이브리드 감면은 2024년 12월 31일에 끝나 일반 승용차와 같습니다.' },
      light:  { name: '경차', rate: 0.04, cut: 750000, until: '2027-12-31', note: '취득일부터 1년 안에 영업용으로 쓰면 감면액을 다시 냅니다.' },
      ev:     { name: '전기차', rate: 0.07, cut: 1400000, until: '2026-12-31', note: '보조금 반영 여부에 따라 견적서 금액과 다를 수 있습니다.' },
      h2:     { name: '수소전기차', rate: 0.07, cut: 1400000, until: '2027-12-31' }
    };
    function run() {
      var price = num('at-price'), kind = $('at-kind').value, t = TYPES[$('at-type').value];
      if (!price) { $('at-out').innerHTML = '<p class="note">차량 가격을 넣으면 계산됩니다.</p>'; return; }
      var base = kind === 'new' ? Math.round(price / 1.1) : price;
      var tax = Math.floor(base * t.rate / 10) * 10;
      var expired = t.until && new Date() > new Date(t.until + 'T23:59:59+09:00');
      var cut = expired ? 0 : Math.min(t.cut, tax);
      var pay = tax - cut;
      var list = [
        [kind === 'new' ? '과세표준 (부가세 뺀 가격)' : '과세표준 (실제 거래 금액)', won(base)],
        ['세율', Math.round(t.rate * 1000) / 10 + '% (' + t.name + ')'],
        ['산출 취득세', won(tax)]
      ];
      if (t.cut) list.push(['감면 (' + won(t.cut) + ' 한도, ' + t.until.replace(/-/g, '.') + '까지)', expired ? '기한 지남' : '− ' + won(cut)]);
      var html = '<p class="big">' + won(pay) + '<small>내야 할 취득세</small></p>' + rows(list);
      var notes = [];
      if (kind === 'used') notes.push('중고차는 거래 금액이 시가표준액보다 낮으면 시가표준액으로 계산합니다.');
      if (t.note) notes.push(t.note);
      if (expired) notes.push('감면 기한이 지났습니다. 연장 여부는 위택스나 관할 시·군·구청에서 확인하세요.');
      notes.push('공채 매입, 번호판·등록 수수료, 탁송료는 별도입니다.');
      html += '<p class="note">' + notes.join(' ') + '</p>';
      $('at-out').innerHTML = html;
    }
    bind(f, run);
  })();

  /* ── 11. 자동차세 ─────────────────────────────────────── */
  (function () {
    var f = $('calc-cartax');
    if (!f) return;
    // 지방세법 제127조·제128조, 시행령 제122조·제125조 (2026.11 시행 기준)
    function run() {
      var ev = $('ct-fuel').value === 'ev', cc = Math.round(num('ct-cc'));
      var y0 = Math.round(num('ct-year')), half = $('ct-half').value, Y = Math.round(num('ct-tax'));
      if (!ev && !cc) { $('ct-out').innerHTML = '<p class="note">배기량을 넣으면 계산됩니다.</p>'; return; }
      if (!y0 || !Y || Y < y0) { $('ct-out').innerHTML = '<p class="note">세금을 낼 연도는 최초 등록 연도와 같거나 그 이후여야 합니다.</p>'; return; }
      var A, h1, h2, age1, age2;
      if (ev) {
        A = 100000; h1 = h2 = A / 2;
      } else {
        A = cc * (cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200);
        age2 = Y - y0 + 1;
        age1 = half === '2' ? Y - y0 : age2;
        var part = function (n) { n = Math.min(Math.max(n, 2), 12); return A / 2 - A / 2 * 0.05 * (n - 2); };
        h1 = part(age1); h2 = part(age2);
      }
      var year = h1 + h2;
      var edu = year * 0.3;
      var leap = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0;
      var days = leap ? 335 : 334, total = leap ? 366 : 365;
      var disc = year * days / total * 0.05;                 // 1월 연납: 2.1~12.31분 × 연 5%
      var janTax = year - disc, janAll = janTax * 1.3;
      var list = [
        ['자동차세 (1년)', won(year) + (ev ? ' (전기차 정액)' : '')],
        ['지방교육세 (30%)', won(edu)],
        ['6월 고지 (상반기)', won(h1 * 1.3)],
        ['12월 고지 (하반기)', won(h2 * 1.3)],
        ['1월 연납 시 (약 ' + (days / total * 5).toFixed(1) + '% 할인)', won(janAll)]
      ];
      var html = '<p class="big">' + won(year + edu) + '<small>' + Y + '년 1년 자동차세 (교육세 포함)</small></p>' + rows(list);
      var notes = [];
      if (!ev) notes.push('차령 ' + (age1 === age2 ? age2 + '년' : '상반기 ' + age1 + '년 · 하반기 ' + age2 + '년') + ', 경감률 ' + (age1 === age2 ? Math.round((1 - h2 / (A / 2)) * 100) + '%' : Math.round((1 - h1 / (A / 2)) * 100) + '% · ' + Math.round((1 - h2 / (A / 2)) * 100) + '%') + '.');
      if (Y === y0) notes.push('처음 등록한 해에는 등록일부터 날수만큼만 냅니다(위 금액보다 적음).');
      if (!ev && year <= 100000) notes.push('1년 자동차세가 10만원 이하라 6월에 1년치가 한 번에 고지될 수 있습니다.');
      notes.push('표준세율 기준이며 지자체 조례·원 단위 절사로 고지서와 조금 다를 수 있습니다.');
      html += '<p class="note">' + notes.join(' ') + '</p>';
      $('ct-out').innerHTML = html;
    }
    bind(f, run);
  })();
  /* ── 12. 월 보험료 적정선 ─────────────────────────────── */
  (function () {
    var f = $('calc-insbudget');
    if (!f) return;
    function run() {
      var salary = num('ib-salary'), now = num('ib-now');
      if (!salary) { $('ib-out').innerHTML = '<p class="note">연봉을 넣으면 계산됩니다.</p>'; return; }
      var d = deductions(salary / 12, 200000, 1, 0);
      var net = salary / 12 - d.total;
      var lo = Math.floor(net * 0.05 / 1000) * 1000, hi = Math.floor(net * 0.10 / 1000) * 1000;
      var list = [
        ['월 예상 실수령액', won(net)],
        ['적정선 하단 (실수령의 5%)', won(lo)],
        ['적정선 상단 (실수령의 10%)', won(hi)]
      ];
      var msg = '';
      if (now) {
        var pct = now / net * 100;
        list.push(['지금 내는 보험료', won(now) + ' (실수령의 ' + pct.toFixed(1) + '%)']);
        msg = pct > 10 ? '실수령의 10%를 넘습니다. 저축성·중복 보장이 섞여 있지 않은지 점검해 보세요.'
            : pct >= 5 ? '적정 범위 안입니다. 보장 내용이 겹치지 않는지만 확인하세요.'
            : '적정선보다 낮습니다. 실손 등 기본 보장이 빠지지 않았는지 확인하세요.';
      }
      $('ib-out').innerHTML = '<p class="big">' + won(lo) + ' ~ ' + won(hi) + '<small>월 보험료 적정선</small></p>' + rows(list) +
        '<p class="note">' + (msg ? msg + ' ' : '') + '부양가족이 없는 사회초년생은 낮은 쪽부터 시작해도 충분한 경우가 많습니다. 흔히 쓰이는 어림 기준이며 정답은 아닙니다.</p>';
    }
    bind(f, run);
  })();
})();
