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
})();
