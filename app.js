// GG-NINEPLANNER — App (Tailwind + SweetAlert2, hardened)
(function () {
  'use strict';

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const byId = (id) => document.getElementById(id);

  const fmtTHB = (n) =>
    isNaN(n) ? '—' :
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n);
  const iNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const int0 = (v) => Math.max(0, Math.floor(iNum(v)));
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const roundTo = (n, step) => Math.round(n / step) * step;

  // ---------- Alert/Toast (with fallback if SweetAlert2 missing) ----------
  function hasSwal(){ return typeof window.Swal !== 'undefined'; }
  const Toast = hasSwal()
    ? Swal.mixin({ toast:true, position:'top-end', showConfirmButton:false, timer:1800, timerProgressBar:true })
    : null;
  function toast(icon, title){
    if (Toast) return Toast.fire({ icon, title });
    // fallback
    console.log(`[${icon}] ${title}`);
  }
  function alertError(title, html){
    if (hasSwal()) return Swal.fire({ icon:'error', title, html, confirmButtonText:'ตกลง' });
    alert(`${title}\n\n${html.replace(/<[^>]+>/g,'')}`);
  }

  // ---------- Theme ----------
  function applyTheme(pref) {
    const dark = pref === 'dark' || (!pref && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const icon = byId('themeIcon');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const dark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('ggnp_theme', dark ? 'dark' : 'light');
    applyTheme(localStorage.getItem('ggnp_theme'));
  }

  // ---------- Schema & State ----------
  const FIELD_SCHEMA = [
    { id: 'age', required: true, type: 'number', min: 18, max: 70 },
    { id: 'sex', required: false, type: 'select' },
    { id: 'income', required: true, type: 'number', min: 1, max: 1_000_000 },
    { id: 'dependents', required: false, type: 'number', min: 0, max: 10 },
    { id: 'smoker', required: false, type: 'select' },
    { id: 'occupation', required: false, type: 'select' },
    { id: 'hospital', required: false, type: 'select' },
    { id: 'homeDebt', required: false, type: 'number', min: 0, max: 100_000_000 },
    { id: 'carDebt', required: false, type: 'number', min: 0, max: 100_000_000 },
    { id: 'priority', required: false, type: 'select' }
  ];
  const FIELD_IDS = FIELD_SCHEMA.map(f => f.id);

  function save() {
    const d = {};
    FIELD_SCHEMA.forEach(f => { const el = byId(f.id); if (el) d[f.id] = el.value; });
    localStorage.setItem('ggnp_form', JSON.stringify(d));
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('ggnp_form') || '{}');
      FIELD_SCHEMA.forEach(f => {
        const el = byId(f.id);
        if (el && d[f.id] !== undefined) el.value = d[f.id];
      });
    } catch { /* ignore */ }
  }

  // ---------- Validation ----------
  function labelOf(id) {
    switch (id) {
      case 'age': return 'อายุ';
      case 'income': return 'รายได้ต่อเดือน';
      case 'dependents': return 'ผู้อยู่ในอุปการะ';
      case 'homeDebt': return 'หนี้บ้านคงเหลือ';
      case 'carDebt': return 'หนี้รถคงเหลือ';
      default: return id;
    }
  }
  function clearFieldError(id) {
    const el = byId(id);
    const err = byId('err-' + id);
    el?.classList.remove('ring-2','ring-red-400','border-red-400');
    if (err) err.textContent = '';
  }
  function setFieldError(id, msg) {
    const el = byId(id);
    const err = byId('err-' + id);
    el?.classList.add('ring-2','ring-red-400','border-red-400');
    if (err) err.textContent = msg;
  }
  function validate() {
    const errors = [];
    FIELD_SCHEMA.forEach(f => clearFieldError(f.id));

    FIELD_SCHEMA.forEach(f => {
      const el = byId(f.id);
      if (!el) return;
      const val = el.value;

      if (f.required && (val === '' || val === null || val === undefined)) {
        errors.push(`กรุณากรอก ${labelOf(f.id)} ให้ครบ`);
        return setFieldError(f.id, 'จำเป็นต้องกรอก');
      }
      if (f.type === 'number' && val !== '') {
        const num = iNum(val);
        if (!Number.isFinite(num)) {
          errors.push(`${labelOf(f.id)} ต้องเป็นตัวเลข`);
          return setFieldError(f.id, 'ต้องเป็นตัวเลข');
        }
        if (f.min !== undefined && num < f.min) {
          errors.push(`${labelOf(f.id)} ต่ำกว่า ${f.min}`);
          return setFieldError(f.id, `ค่าอย่างน้อย ${f.min}`);
        }
        if (f.max !== undefined && num > f.max) {
          errors.push(`${labelOf(f.id)} สูงเกินไป`);
          return setFieldError(f.id, `ค่าสูงสุด ${f.max}`);
        }
      }
    });

    // cross-field
    const age = iNum(byId('age')?.value);
    const income = iNum(byId('income')?.value);
    if (Number.isFinite(age) && (age < 18 || age > 70)) {
      errors.push('อายุต้องอยู่ 18–70 ปี');
      setFieldError('age', '18–70 ปี');
    }
    if (!Number.isFinite(income) || income <= 0) {
      errors.push('รายได้ต่อเดือนต้องมากกว่า 0');
      setFieldError('income', 'กรอก > 0');
    }

    const banner = byId('errorBanner');
    if (errors.length) {
      banner?.classList.remove('hidden');
      if (banner) banner.innerHTML = '<b>ไม่สามารถคำนวณได้:</b> ' + errors.map(e => `<span class="ml-2">• ${e}</span>`).join(' ');
    } else {
      banner?.classList.add('hidden');
      if (banner) banner.innerHTML = '';
    }
    return { ok: errors.length === 0, errors };
  }

  // ---------- UI Effects ----------
  function animateNumber(el, to, duration = 700) {
    if (!el) return;
    const start = performance.now(); const from = 0; const diff = to - from;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = fmtTHB(from + diff * p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Core Calc ----------
  function calc() {
    try {
      const v = validate();
      if (!v.ok) {
        alertError('กรอกข้อมูลไม่ครบ/ไม่ถูกต้อง', v.errors.map(e => `<div class="text-left">• ${e}</div>`).join(''));
        return;
      }

      const age = int0(byId('age').value);
      const income = int0(byId('income').value);
      const dependents = int0(byId('dependents').value || 0);
      const smoker = byId('smoker').value === 'yes';
      const occ = byId('occupation').value;
      const hospital = byId('hospital').value;
      const homeDebt = int0(byId('homeDebt').value || 0);
      const carDebt = int0(byId('carDebt').value || 0);
      const priority = byId('priority').value;

      const annual = income * 12;
      const debt = homeDebt + carDebt;

      // Budget %
      let autoPerc =
        income < 5000 ? 0.04 :
        income < 10000 ? 0.05 :
        income <= 20000 ? 0.07 : 0.08;
      if (smoker) autoPerc += 0.01;
      if (dependents >= 2) autoPerc += 0.01;
      if (priority === 'health') autoPerc -= 0.005;
      autoPerc = clamp(autoPerc, 0.03, 0.10);

      const useAuto = byId('autoBudget')?.checked ?? true;
      const usedPerc = useAuto ? autoPerc : ((+byId('manualBudget').value || 7) / 100);

      const budget = income * usedPerc;
      const rangeMin = income * 0.03, rangeMax = income * 0.10;

      const years = dependents >= 2 ? 5 : 3;
      const lifeBase = roundTo(debt + (annual * years), 50_000);
      const lifeA = roundTo(lifeBase * 0.75, 50_000);
      const lifeB = lifeBase;
      const lifeC = roundTo(lifeBase * 1.25, 50_000);

      // Critical Illness
      let ciA = 300_000, ciB = 500_000, ciC = 1_000_000;
      if (age < 30) { ciA = 200_000; ciB = 400_000; ciC = 800_000; }
      if (age >= 45) { ciA = 400_000; ciB = 600_000; ciC = 1_000_000; }

      // PA by occupation
      const occBoost = occ === 'high' ? 200_000 : (occ === 'med' ? 100_000 : 0);
      const paA = 300_000 + occBoost, paB = 500_000 + occBoost, paC = 700_000 + occBoost;

      // Hospital Cash
      const cashA = hospital === 'public' ? 1000 : 800;
      const cashB = hospital === 'public' ? 1500 : 1200;
      const cashC = hospital === 'public' ? 2000 : 1500;

      // Mix bars
      let mix = { life: 50, ci: 25, pa: 15, cash: 10 };
      if (priority === 'health') mix = { life: 40, ci: 35, pa: 15, cash: 10 };
      if (priority === 'savings') mix = { life: 55, ci: 20, pa: 15, cash: 10 };
      const setBar = (id, pct, label) => { const b = byId(id), t = byId(label); if (b) b.style.width = pct + '%'; if (t) t.textContent = pct + '%'; };
      setBar('barLife', mix.life, 'pctLife');
      setBar('barCI',   mix.ci,   'pctCI');
      setBar('barPA',   mix.pa,   'pctPA');
      setBar('barCash', mix.cash, 'pctCash');

      // KPIs
      animateNumber(byId('kpiBudget'), budget);
      const kpiPct = byId('kpiPct'); if (kpiPct) kpiPct.textContent = `≈ ${(usedPerc * 100).toFixed(1)}% ของรายได้`;
      const kpiRange = byId('kpiRange'); if (kpiRange) kpiRange.textContent = `${fmtTHB(rangeMin)} – ${fmtTHB(rangeMax)}`;
      const kpiLife = byId('kpiLife'); if (kpiLife) kpiLife.textContent = fmtTHB(lifeBase);

      // Plans
      const setTxt = (id, v) => { const el = byId(id); if (el) el.textContent = v; };
      setTxt('a_life', fmtTHB(lifeA)); setTxt('b_life', fmtTHB(lifeB)); setTxt('c_life', fmtTHB(lifeC));
      setTxt('a_ci', fmtTHB(ciA));     setTxt('b_ci', fmtTHB(ciB));     setTxt('c_ci', fmtTHB(ciC));
      setTxt('a_pa', fmtTHB(paA));     setTxt('b_pa', fmtTHB(paB));     setTxt('c_pa', fmtTHB(paC));
      setTxt('a_cash', `${cashA.toLocaleString('th-TH')} บ./วัน`);
      setTxt('b_cash', `${cashB.toLocaleString('th-TH')} บ./วัน`);
      setTxt('c_cash', `${cashC.toLocaleString('th-TH')} บ./วัน`);

      // Hints
      const publicHosp = hospital === 'public';
      const aHint = ['โฟกัสปิดหนี้หลักและเหตุหนักก่อน', publicHosp ? 'ใช้สิทธิ รพ.รัฐ + เสริมชดเชยรายวัน' : 'ใช้เอกชนบ่อย → พิจารณา IPD ภายหลัง'];
      if (income < 10000) aHint.push('คุมงบ 3–6% ของรายได้/เดือนก่อน');
      const bHint = ['สมดุล ชีวิต/โรคร้าย/อุบัติเหตุ/รายได้หาย'];
      if (dependents > 0) bHint.push('เพิ่มทุนชีวิตให้ครอบคลุมผู้พึ่งพิง');
      if (occ !== 'low') bHint.push('งานเสี่ยง → เพิ่มทุน PA');
      const cHint = ['เพิ่ม CI และเงินชดเชยรายวันสำหรับระยะยาว'];
      if (age >= 40) cHint.push('วัยเสี่ยง NCD → ดัน CI สูงขึ้น');
      const setBullets = (id, arr) => { const el = byId(id); if (el) el.textContent = '• ' + arr.join(' • '); };
      setBullets('a_hint', aHint); setBullets('b_hint', bHint); setBullets('c_hint', cHint);

      // Advice
      const tips = [];
      if (dependents > 0) tips.push('มีคนพึ่งพิง → ดันทุนชีวิต ≥ หนี้รวม + ค่าใช้จ่าย 2–3 ปี');
      tips.push(publicHosp ? 'ใช้ รพ.รัฐบ่อย → Hospital Cash ช่วยชดเชยรายได้'
                           : 'ใช้ รพ.เอกชน → ดูวงเงินค่าห้อง IPD ของโรงพยาบาล');
      if (occ === 'high') tips.push('งานภาคสนาม → เพิ่มทุน PA และอ่านข้อยกเว้นอาชีพ');
      tips.push(byId('smoker').value === 'yes'
        ? 'สูบบุหรี่ → เบี้ยอาจสูงขึ้น ควรตรวจสุขภาพก่อนทำ'
        : 'ไม่สูบ → เบี้ยโดยรวมมักดีกว่า');
      if (income <= 20000) tips.push('คุมงบที่ 5–10% ของรายได้/เดือน แล้วค่อยเพิ่มเมื่อรายได้โต');
      const advice = byId('advice'); if (advice) advice.innerHTML = tips.map(t => `<li>${t}</li>`).join('');

      // Recommend badge
      const badge = byId('b_badge');
      if (badge) badge.textContent = (usedPerc <= 0.085 && usedPerc > 0.055) ? 'เหมาะสมตามงบ' : 'ตัวเลือกกลาง';

      // Summary
      const summary = [
        `งบแนะนำ/เดือน: ${fmtTHB(budget)} (≈ ${(usedPerc * 100).toFixed(1)}% ของรายได้; ช่วงอ้างอิง ${fmtTHB(rangeMin)}–${fmtTHB(rangeMax)})`,
        `ทุนชีวิตฐาน (หนี้รวม + รายได้×${dependents >= 2 ? 5 : 3}ปี): ${fmtTHB(lifeBase)}`,
        `A: Life ${fmtTHB(lifeA)} | CI ${fmtTHB(ciA)} | PA ${fmtTHB(paA)} | Cash ${cashA.toLocaleString('th-TH')} บ./วัน`,
        `B: Life ${fmtTHB(lifeB)} | CI ${fmtTHB(ciB)} | PA ${fmtTHB(paB)} | Cash ${cashB.toLocaleString('th-TH')} บ./วัน`,
        `C: Life ${fmtTHB(lifeC)} | CI ${fmtTHB(ciC)} | PA ${fmtTHB(paC)} | Cash ${cashC.toLocaleString('th-TH')} บ./วัน`,
        `หมายเหตุ: ข้อมูลนี้ใช้เพื่อประกอบการตัดสินใจเบื้องต้น ไม่ใช่ใบเสนอราคา — สอบถามเพจ GG-NinePlanner`
      ].join('\n');
      document.body.dataset.summary = summary;

      save();
      toast('success', 'คำนวณเสร็จแล้ว ✅');
    } catch (err) {
      console.error('Calc error:', err);
      toast('error', 'เกิดข้อผิดพลาดในการคำนวณ');
    }
  }

  // ---------- Events ----------
  function bindSafe(id, ev, fn) {
    const el = byId(id);
    if (!el) { console.warn('Missing element:', id); return; }
    el.addEventListener(ev, fn);
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      // Theme
      applyTheme(localStorage.getItem('ggnp_theme'));
      bindSafe('themeBtn', 'click', toggleTheme);
      bindSafe('printBtn', 'click', () => window.print());

      // Load & bind fields
      load();
      FIELD_IDS.forEach(id => {
        const el = byId(id);
        if (!el) return;
        el.addEventListener('input', () => { clearFieldError(id); setTimeout(calc, 0); });
        el.addEventListener('change', save);
      });

      // Enter -> calc
      byId('form')?.addEventListener('submit', (e) => { e.preventDefault(); calc(); });

      // Advanced
      bindSafe('toggleAdvanced', 'click', () => byId('advanced')?.classList.toggle('hidden'));
      const auto = byId('autoBudget');
      const wrap = byId('manualBudgetWrap');
      const manual = byId('manualBudget');
      const manualPct = byId('manualBudgetPct');
      if (auto) {
        auto.addEventListener('change', () => {
          const on = auto.checked;
          if (wrap) {
            wrap.classList.toggle('opacity-50', on);
            wrap.classList.toggle('pointer-events-none', on);
          }
        });
      }
      if (manual) {
        manual.addEventListener('input', () => {
          if (manualPct) manualPct.textContent = (manual.value || '7') + '%';
          calc();
        });
      }

      // Presets (FIX: ถูกต้องคือ '[data-preset]' ไม่ใช่ '.[data-preset]')
      $$('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.getAttribute('data-preset');
          const set = (id, v) => { const el = byId(id); if (el) el.value = v; };

          if (p === 'teacher') {
            set('age', 38); set('sex', 'male'); set('income', 20000); set('dependents', 1);
            set('smoker', 'no'); set('occupation', 'low'); set('hospital', 'public');
            set('homeDebt', 800000); set('carDebt', 250000); set('priority', 'risk');
          } else if (p === 'freelance') {
            set('age', 30); set('sex', 'na'); set('income', 15000); set('dependents', 0);
            set('smoker', 'no'); set('occupation', 'med'); set('hospital', 'private');
            set('homeDebt', 0); set('carDebt', 0); set('priority', 'health');
          } else if (p === 'family') {
            set('age', 35); set('sex', 'female'); set('income', 22000); set('dependents', 2);
            set('smoker', 'no'); set('occupation', 'low'); set('hospital', 'public');
            set('homeDebt', 600000); set('carDebt', 150000); set('priority', 'risk');
          } else if (p === 'starter') {
            set('age', 28); set('sex', 'na'); set('income', 9000); set('dependents', 0);
            set('smoker', 'no'); set('occupation', 'med'); set('hospital', 'public');
            set('homeDebt', 0); set('carDebt', 0); set('priority', 'risk');
          }
          calc();
          toast('info', 'เติมข้อมูลตัวอย่างแล้ว');
        });
      });

      // Buttons
      bindSafe('calcBtn', 'click', calc);
      bindSafe('quickCalc', 'click', () => {
        byId('age').value = 38; byId('sex').value = 'male'; byId('income').value = 20000; byId('dependents').value = 1;
        byId('smoker').value = 'no'; byId('occupation').value = 'low'; byId('hospital').value = 'public';
        byId('homeDebt').value = 800000; byId('carDebt').value = 250000; byId('priority').value = 'risk';
        calc();
      });

      bindSafe('copyBtn', 'click', async () => {
        const s = document.body.dataset.summary || '';
        if (!s) return toast('warning', 'กรอกและคำนวณก่อน');
        try { await navigator.clipboard.writeText(s); toast('success', 'คัดลอกสรุปแล้ว'); }
        catch { toast('error', 'คัดลอกไม่สำเร็จ'); }
      });

      function share() {
        const s = document.body.dataset.summary || '';
        if (!s) return toast('warning', 'กรอกและคำนวณก่อน');
        if (navigator.share) {
          navigator.share({ title: 'สรุปแผนคุ้มครอง — GG-NinePlanner', text: s }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(s);
          toast('info', 'คัดลอกสรุปแล้ว');
        }
      }
      bindSafe('shareBtn', 'click', share);

      bindSafe('exportBtn', 'click', () => {
        const data = {
          fields: Object.fromEntries(FIELD_IDS.map(id => [id, byId(id)?.value])),
          summary: document.body.dataset.summary || ''
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'gg-nineplanner.json'; a.click();
        URL.revokeObjectURL(url);
      });

      bindSafe('resetBtn', 'click', () => {
        if (hasSwal()){
          Swal.fire({ icon:'warning', title:'ล้างข้อมูลทั้งหมด?', showCancelButton:true, confirmButtonText:'ล้าง', cancelButtonText:'ยกเลิก' })
            .then(res => { if (res.isConfirmed) { localStorage.removeItem('ggnp_form'); location.reload(); } });
        } else {
          if (confirm('ล้างข้อมูลทั้งหมด?')) { localStorage.removeItem('ggnp_form'); location.reload(); }
        }
      });

      // Auto calc if minimal present
      if (byId('age')?.value && byId('income')?.value) calc();
    } catch (e) {
      console.error('Init error:', e);
      toast('error', 'เกิดข้อผิดพลาดในการเริ่มต้นแอป');
    }
  });
})();
