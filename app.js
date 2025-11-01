// GG-NINEPLANNER Static App
(function(){
  'use strict';

  // ===== Helpers =====
  const $ = (s)=> document.querySelector(s);
  const $$ = (s)=> document.querySelectorAll(s);
  const byId = (id)=> document.getElementById(id);

  const fmtTHB = (n)=> isNaN(n)? '—' : new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(n);
  const fmtNum = (n)=> isNaN(n)? 0 : Math.max(0, Math.floor(n));
  const roundTo = (n, step)=> Math.round(n/step)*step;
  const clamp = (n, min, max)=> Math.min(max, Math.max(min,n));

  function toast(msg){
    const host = byId('toast');
    if(!host) return;
    host.innerHTML = `<div>${msg}</div>`;
    clearTimeout(window.__toastTimeout);
    window.__toastTimeout = setTimeout(()=> host.innerHTML = '', 1800);
  }

  // ===== Theme =====
  function applyTheme(pref){
    const root = document.documentElement;
    const icon = byId('themeIcon');
    const dark = pref==='dark' || (!pref && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    if(icon) icon.textContent = dark ? '☀️' : '🌙';
  }
  function toggleTheme(){
    const dark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('ggnp_theme', dark? 'dark':'light');
    applyTheme(localStorage.getItem('ggnp_theme'));
  }

  // ===== State (save/load) =====
  const fields = ['age','sex','income','dependents','smoker','occupation','hospital','homeDebt','carDebt','priority'];
  function save(){
    const d={}; fields.forEach(k=>{ const el=byId(k); if(el) d[k]=el.value; });
    localStorage.setItem('ggnp_form', JSON.stringify(d));
  }
  function load(){
    try{
      const d = JSON.parse(localStorage.getItem('ggnp_form')||'{}');
      fields.forEach(k=>{ const el=byId(k); if(el && d[k]!==undefined) el.value=d[k]; });
    }catch(e){}
  }

  // ===== Validation =====
  function validate(){
    const errors = [];
    const age = +byId('age').value;
    const income = +byId('income').value;

    // reset
    ['age','income'].forEach(id=>{
      byId(id).classList.remove('invalid');
      byId('err-'+id).textContent='';
    });

    if(!(age>=18 && age<=70)){
      errors.push('อายุต้องอยู่ระหว่าง 18–70 ปี');
      byId('age').classList.add('invalid');
      byId('err-age').textContent = 'กรุณากรอก 18–70';
    }
    if(!(income>0)){
      errors.push('กรุณากรอกรายได้ต่อเดือน (> 0)');
      byId('income').classList.add('invalid');
      byId('err-income').textContent = 'เช่น 20000';
    }

    const banner = byId('errorBanner');
    if(errors.length){
      banner.hidden = false;
      banner.innerHTML = '<b>ไม่สามารถคำนวณได้:</b> ' + errors.map(e=>`<span>• ${e}</span>`).join(' ');
    }else{
      banner.hidden = true;
      banner.innerHTML = '';
    }
    return errors.length === 0;
  }

  // ===== Animations =====
  function animateNumber(el, to, duration=700){
    if(!el) return;
    const start = performance.now(); const from = 0; const diff = to - from;
    function tick(now){
      const p = Math.min(1, (now-start)/duration);
      el.textContent = fmtTHB(from + diff*p);
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function showPlans(){
    ['planA','planB','planC'].forEach((id,i)=>{
      const el = byId(id);
      if(!el) return;
      el.classList.add('show');
      el.classList.remove('hidden');
      el.style.animationDelay = `${i*80}ms`;
    });
  }

  // ===== Core calc =====
  function calc(){
    try{
      if(!validate()){ toast('กรอกข้อมูลให้ครบก่อนคำนวณ'); return; }

      const age = fmtNum(+byId('age').value);
      const income = fmtNum(+byId('income').value);
      const dependents = fmtNum(+byId('dependents').value||0);
      const smoker = byId('smoker').value==='yes';
      const occ = byId('occupation').value;
      const hospital = byId('hospital').value;
      const homeDebt = fmtNum(+byId('homeDebt').value||0);
      const carDebt = fmtNum(+byId('carDebt').value||0);
      const priority = byId('priority').value;

      const annual = income*12;
      const debt = homeDebt + carDebt;

      // Percent budget (auto or manual)
      let autoPerc = income < 5000 ? 0.04 : income < 10000 ? 0.05 : income <= 20000 ? 0.07 : 0.08;
      if(smoker) autoPerc += 0.01;
      if(dependents>=2) autoPerc += 0.01;
      if(priority==='health') autoPerc -= 0.005;
      autoPerc = clamp(autoPerc, 0.03, 0.10);

      const useAuto = byId('autoBudget')?.checked ?? true;
      const usedPerc = useAuto ? autoPerc : ((+byId('manualBudget').value||7)/100);

      const budget = income*usedPerc;
      const rangeMin = income*0.03, rangeMax=income*0.10;

      const years = dependents>=2? 5:3;
      let lifeBase = roundTo(debt + (annual*years), 50000);
      const lifeA = roundTo(lifeBase*0.75, 50000);
      const lifeB = lifeBase;
      const lifeC = roundTo(lifeBase*1.25, 50000);

      let ciA=300000, ciB=500000, ciC=1000000;
      if(age<30){ciA=200000;ciB=400000;ciC=800000;}
      if(age>=45){ciA=400000;ciB=600000;ciC=1000000;}

      const occBoost = occ==='high'?200000:(occ==='med'?100000:0);
      const paA=300000+occBoost, paB=500000+occBoost, paC=700000+occBoost;

      const cashA=hospital==='public'?1000:800;
      const cashB=hospital==='public'?1500:1200;
      const cashC=hospital==='public'?2000:1500;

      // Mix bars by priority
      let mix = { life:50, ci:25, pa:15, cash:10 };
      if(priority==='health') mix = { life:40, ci:35, pa:15, cash:10 };
      if(priority==='savings') mix = { life:55, ci:20, pa:15, cash:10 };
      byId('barLife').style.width = mix.life+'%'; byId('pctLife').textContent = mix.life+'%';
      byId('barCI').style.width   = mix.ci+'%';   byId('pctCI').textContent  = mix.ci+'%';
      byId('barPA').style.width   = mix.pa+'%';   byId('pctPA').textContent  = mix.pa+'%';
      byId('barCash').style.width = mix.cash+'%'; byId('pctCash').textContent= mix.cash+'%';

      // KPIs
      animateNumber(byId('kpiBudget'), budget);
      byId('kpiPct').textContent = `≈ ${(usedPerc*100).toFixed(1)}% ของรายได้`;
      byId('kpiRange').textContent = `${fmtTHB(rangeMin)} – ${fmtTHB(rangeMax)}`;
      byId('kpiLife').textContent = fmtTHB(lifeBase);

      // Plans
      const setTxt = (id, v)=>{ const el=byId(id); if(el) el.textContent=v; };
      setTxt('a_life', fmtTHB(lifeA)); setTxt('b_life', fmtTHB(lifeB)); setTxt('c_life', fmtTHB(lifeC));
      setTxt('a_ci', fmtTHB(ciA));     setTxt('b_ci', fmtTHB(ciB));     setTxt('c_ci', fmtTHB(ciC));
      setTxt('a_pa', fmtTHB(paA));     setTxt('b_pa', fmtTHB(paB));     setTxt('c_pa', fmtTHB(paC));
      setTxt('a_cash', `${cashA.toLocaleString('th-TH')} บ./วัน`);
      setTxt('b_cash', `${cashB.toLocaleString('th-TH')} บ./วัน`);
      setTxt('c_cash', `${cashC.toLocaleString('th-TH')} บ./วัน`);

      // Hints
      const publicHosp = hospital==='public';
      const aHint = ['โฟกัสปิดหนี้หลักและเหตุหนักก่อน', publicHosp? 'ใช้สิทธิ รพ.รัฐ + เสริมชดเชยรายวัน':'ใช้เอกชนบ่อย → พิจารณา IPD ภายหลัง'];
      if(income<10000) aHint.push('คุมงบ 3–6% ของรายได้/เดือนก่อน');
      const bHint = ['สมดุล ชีวิต/โรคร้าย/อุบัติเหตุ/รายได้หาย'];
      if(dependents>0) bHint.push('เพิ่มทุนชีวิตให้ครอบคลุมผู้พึ่งพิง');
      if(occ!=='low') bHint.push('งานเสี่ยง → เพิ่มทุน PA');
      const cHint = ['เพิ่ม CI และเงินชดเชยรายวันสำหรับระยะยาว'];
      if(age>=40) cHint.push('วัยเสี่ยง NCD → ดัน CI สูงขึ้น');
      const setBullets = (id, arr)=>{ const el=byId(id); if(el) el.textContent = '• ' + arr.join(' • '); };
      setBullets('a_hint', aHint); setBullets('b_hint', bHint); setBullets('c_hint', cHint);

      // Advice
      const tips = [];
      if(dependents>0) tips.push('มีคนพึ่งพิง → ดันทุนชีวิต ≥ หนี้รวม + ค่าใช้จ่าย 2–3 ปี');
      tips.push(publicHosp ? 'ใช้ รพ.รัฐบ่อย → Hospital Cash ช่วยชดเชยรายได้' : 'ใช้ รพ.เอกชน → ดูวงเงินค่าห้อง IPD ของโรงพยาบาล');
      if(occ==='high') tips.push('งานภาคสนาม → เพิ่มทุน PA และอ่านข้อยกเว้นอาชีพ');
      tips.push(smoker ? 'สูบบุหรี่ → เบี้ยอาจสูงขึ้น ควรตรวจสุขภาพก่อนทำ' : 'ไม่สูบ → เบี้ยมักดีกว่ากลุ่มสูบ');
      if(income<=20000) tips.push('คุมงบที่ 5–10% ของรายได้/เดือน แล้วค่อยเพิ่มเมื่อรายได้โต');
      byId('advice').innerHTML = tips.map(t=>`<li>${t}</li>`).join('');

      // Recommend highlight
      ['planA','planB','planC'].forEach(id=> byId(id)?.classList.remove('highlight'));
      const sel = usedPerc<=0.055? 'planA' : usedPerc<=0.085? 'planB' : 'planC';
      ['planA','planB','planC'].forEach(id=> byId(id)?.classList.add('show'));
      if(sel==='planB') byId('b_badge').textContent='เหมาะสมตามงบ'; else byId('b_badge').textContent='ตัวเลือกกลาง';

      // Summary for share/copy
      const summary = [
        `งบแนะนำ/เดือน: ${fmtTHB(budget)} (≈ ${(usedPerc*100).toFixed(1)}% ของรายได้; ช่วงอ้างอิง ${fmtTHB(rangeMin)}–${fmtTHB(rangeMax)})`,
        `ทุนชีวิตฐาน (หนี้รวม + รายได้×${dependents>=2?5:3}ปี): ${fmtTHB(lifeBase)}`,
        `A: Life ${fmtTHB(lifeA)} | CI ${fmtTHB(ciA)} | PA ${fmtTHB(paA)} | Cash ${cashA.toLocaleString('th-TH')} บ./วัน`,
        `B: Life ${fmtTHB(lifeB)} | CI ${fmtTHB(ciB)} | PA ${fmtTHB(paB)} | Cash ${cashB.toLocaleString('th-TH')} บ./วัน`,
        `C: Life ${fmtTHB(lifeC)} | CI ${fmtTHB(ciC)} | PA ${fmtTHB(paC)} | Cash ${cashC.toLocaleString('th-TH')} บ./วัน`,
        `หมายเหตุ: ข้อมูลนี้ใช้เพื่อประกอบการตัดสินใจเบื้องต้น ไม่ใช่ใบเสนอราคา — สอบถามเพจ GG-NinePlanner`
      ].join('\n');
      document.body.dataset.summary = summary;

      save();
      showPlans();
      toast('คำนวณเสร็จแล้ว ✅');
    }catch(err){
      console.error('Calc error:', err);
      toast('เกิดข้อผิดพลาดในการคำนวณ');
    }
  }

  // ===== Events =====
  function bindSafe(id, ev, fn){
    const el = byId(id);
    if(!el){ console.warn('Missing element:', id); return; }
    el.addEventListener(ev, fn);
  }

  document.addEventListener('DOMContentLoaded', () => {
    try{
      // Theme
      applyTheme(localStorage.getItem('ggnp_theme'));
      bindSafe('themeBtn','click', toggleTheme);
      bindSafe('printBtn','click', ()=> window.print());

      // Load state
      load();

      // Bind inputs
      fields.forEach(k=>{
        const el = byId(k);
        if(!el) return;
        el.addEventListener('input', ()=> setTimeout(calc, 0));
        el.addEventListener('change', save);
      });

      // Advanced panel
      bindSafe('toggleAdvanced','click', ()=> byId('advanced').classList.toggle('hidden'));
      const auto = byId('autoBudget'); const manualWrap = byId('manualBudgetWrap');
      if(auto){ auto.addEventListener('change', ()=> manualWrap.classList.toggle('disabled', auto.checked)); }
      const manual = byId('manualBudget'); const manualPct = byId('manualBudgetPct');
      if(manual){ manual.addEventListener('input', ()=>{ manualPct.textContent = (manual.value||'7')+'%'; calc(); }); }

      // Presets
      $$('.btn-chip[data-preset]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const p = btn.getAttribute('data-preset');
          const set = (id,val)=>{ const el=byId(id); if(el) el.value=val; };
          if(p==='teacher'){
            set('age',38); set('sex','male'); set('income',20000); set('dependents',1);
            set('smoker','no'); set('occupation','low'); set('hospital','public');
            set('homeDebt',800000); set('carDebt',250000); set('priority','risk');
          }else if(p==='freelance'){
            set('age',30); set('sex','na'); set('income',15000); set('dependents',0);
            set('smoker','no'); set('occupation','med'); set('hospital','private');
            set('homeDebt',0); set('carDebt',0); set('priority','health');
          }else if(p==='family'){
            set('age',35); set('sex','female'); set('income',22000); set('dependents',2);
            set('smoker','no'); set('occupation','low'); set('hospital','public');
            set('homeDebt',600000); set('carDebt',150000); set('priority','risk');
          }else if(p==='starter'){
            set('age',28); set('sex','na'); set('income',9000); set('dependents',0);
            set('smoker','no'); set('occupation','med'); set('hospital','public');
            set('homeDebt',0); set('carDebt',0); set('priority','risk');
          }
          calc();
        });
      });

      // Buttons
      bindSafe('calcBtn','click', calc);
      bindSafe('mobileCalc','click', calc);
      bindSafe('quickCalc','click', ()=>{
        byId('age').value=38; byId('sex').value='male'; byId('income').value=20000; byId('dependents').value=1;
        byId('smoker').value='no'; byId('occupation').value='low'; byId('hospital').value='public';
        byId('homeDebt').value=800000; byId('carDebt').value=250000; byId('priority').value='risk';
        calc();
      });

      bindSafe('copyBtn','click', async ()=>{
        const s = document.body.dataset.summary||'';
        if(!s){ toast('กรอกและคำนวณก่อน'); return; }
        try{ await navigator.clipboard.writeText(s); toast('คัดลอกสรุปแล้ว'); }
        catch(e){ toast('คัดลอกไม่สำเร็จ'); }
      });

      function share(){
        const s = document.body.dataset.summary||'';
        if(!s){ toast('กรอกและคำนวณก่อน'); return; }
        if(navigator.share){ navigator.share({ title:'สรุปแผนคุ้มครอง — GG-NinePlanner', text:s }).catch(()=>{}); }
        else{ navigator.clipboard?.writeText(s); toast('คัดลอกสรุปแล้ว'); }
      }
      bindSafe('shareBtn','click', share);
      bindSafe('mobileShare','click', share);

      bindSafe('exportBtn','click', ()=>{
        const data = { fields: Object.fromEntries(fields.map(k=>[k, byId(k)?.value])), summary: document.body.dataset.summary||'' };
        const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='gg-nineplanner.json'; a.click(); URL.revokeObjectURL(url);
      });

      bindSafe('resetBtn','click', ()=>{ if(confirm('ล้างข้อมูลทั้งหมด?')){ localStorage.removeItem('ggnp_form'); location.reload(); } });

      // Pre-calc if minimal values exist
      if(byId('age')?.value && byId('income')?.value){ calc(); }
    }catch(e){
      console.error('Init error:', e);
      toast('เกิดข้อผิดพลาดในการเริ่มต้นแอป');
    }
  });

})();
