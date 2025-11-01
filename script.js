(function(){
  // ===== Utilities =====
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);
  const fmtTHB=(n)=> isNaN(n)? '—' : new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(n);
  const fmtNum=(n)=> isNaN(n)? 0 : Math.max(0, Math.floor(n));
  const roundTo=(n,step)=>Math.round(n/step)*step;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const fields=['age','sex','income','dependents','smoker','occupation','hospital','homeDebt','carDebt','priority'];

  // ===== Theme =====
  function applyTheme(pref){
    const root=document.documentElement;
    if(pref==='dark'||(!pref&&window.matchMedia('(prefers-color-scheme: dark)').matches)){
      root.classList.add('dark'); $('#sun')?.classList.remove('hidden'); $('#moon')?.classList.add('hidden');
    } else { root.classList.remove('dark'); $('#sun')?.classList.add('hidden'); $('#moon')?.classList.remove('hidden'); }
  }
  applyTheme(localStorage.getItem('theme'));
  $('#themeBtn')?.addEventListener('click',()=>{ const nowDark=!document.documentElement.classList.contains('dark'); localStorage.setItem('theme',nowDark?'dark':'light'); applyTheme(localStorage.getItem('theme')); });

  // ===== CDN status & Toast =====
  const hasTw=!!window.tailwind, hasSwal=!!window.Swal; const st=$('#cdnStatus'); if(st){ st.classList.remove('hidden'); $('#stTw').textContent=hasTw?'TW✅':'TW❌'; $('#stSwal').textContent=hasSwal?'SW✅':'SW❌'; }
  const Toast = hasSwal? Swal.mixin({toast:true,position:'top-end',showConfirmButton:false,timer:1800,timerProgressBar:true,padding:'10px 14px',didOpen:(t)=>{t.addEventListener('mouseenter',Swal.stopTimer);t.addEventListener('mouseleave',Swal.resumeTimer);}}) : { fire: ({icon,title})=>console.log(icon||'info',title||'') };
  window.addEventListener('error',(e)=>{ try{ Toast.fire({icon:'error',title:'สคริปต์มีปัญหา: '+e.message}); }catch(_){ alert('สคริปต์มีปัญหา: '+e.message); } });

  // ===== Save/Load =====
  function save(){ const d={}; fields.forEach(k=> d[k]=$('#'+k)?.value); localStorage.setItem('ggnp_form',JSON.stringify(d)); }
  function load(){ try{ const d=JSON.parse(localStorage.getItem('ggnp_form')||'{}'); fields.forEach(k=>{ if(d[k]!==undefined&&$('#'+k)) $('#'+k).value=d[k];}); }catch(e){} }

  // ===== Debounce =====
  function debounce(fn,wait=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; }
  const debouncedCalc=debounce(calc,150);

  // ===== Advanced toggles =====
  $('#toggleAdvanced')?.addEventListener('click',()=> $('#advanced')?.classList.toggle('hidden'));
  const autoBudget=$('#autoBudget'), manualBudget=$('#manualBudget'), manualBudgetWrap=$('#manualBudgetWrap'), manualBudgetPct=$('#manualBudgetPct');
  autoBudget?.addEventListener('change',()=>{ if(manualBudgetWrap) manualBudgetWrap.style.opacity = autoBudget.checked? .5:1; debouncedCalc(); });
  manualBudget?.addEventListener('input',()=>{ if(manualBudgetPct) manualBudgetPct.textContent=manualBudget.value+'%'; debouncedCalc(); });

  // ===== Presets =====
  $$('[data-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const p=btn.dataset.preset; const set=(m)=>Object.entries(m).forEach(([k,v])=>{ const el=$('#'+k); if(el) el.value=v; });
      if(p==='teacher')  set({age:38,sex:'male',income:20000,dependents:1,smoker:'no',occupation:'low',hospital:'public',homeDebt:800000,carDebt:250000,priority:'risk'});
      if(p==='freelance') set({age:30,sex:'na',  income:15000,dependents:0,smoker:'no',occupation:'med',hospital:'private',homeDebt:0,carDebt:0,priority:'health'});
      if(p==='family')   set({age:35,sex:'female',income:22000,dependents:2,smoker:'no',occupation:'low',hospital:'public',homeDebt:600000,carDebt:150000,priority:'risk'});
      if(p==='starter')  set({age:28,sex:'na',  income:9000, dependents:0,smoker:'no',occupation:'med',hospital:'public',homeDebt:0,carDebt:0,priority:'risk'});
      calc();
    });
  });

  // ===== Render helpers =====
  function setBar(elW,pct){ if(!elW) return; elW.style.width = pct+'%'; }
  function show(el){ el?.classList.remove('hidden'); el?.classList.add('detail'); }
  function hide(el){ el?.classList.add('hidden'); }

  // ===== Core calc (single recommended plan) =====
  let lastPlan='';
  function calc(){
    const age=fmtNum(+$('#age')?.value), income=fmtNum(+$('#income')?.value), dependents=fmtNum(+$('#dependents')?.value||0);
    const smoker = ($('#smoker')?.value==='yes'); const occ=$('#occupation')?.value; const hospital=$('#hospital')?.value; const homeDebt=fmtNum(+$('#homeDebt')?.value||0), carDebt=fmtNum(+$('#carDebt')?.value||0); const priority=$('#priority')?.value;

    let valid=true; if(!(age>=18&&age<=70)){ valid=false; $('#age')?.setAttribute('aria-invalid','true'); } else { $('#age')?.removeAttribute('aria-invalid'); }
    if(!(income>0)){ valid=false; $('#income')?.setAttribute('aria-invalid','true'); } else { $('#income')?.removeAttribute('aria-invalid'); }
    if(!valid){ try{ Toast.fire({icon:'error',title:'กรอกอายุ 18–70 ปี และรายได้ต่อเดือนให้ถูกต้อง'});}catch(_){ alert('กรอกข้อมูลให้ครบ'); } return; }

    const annual=income*12, debt=homeDebt+carDebt;
    let autoPerc = income<5000?0.04 : income<10000?0.05 : income<=20000?0.07 : 0.08; if(smoker) autoPerc+=0.01; if(dependents>=2) autoPerc+=0.01; if(priority==='health') autoPerc-=0.005; autoPerc=clamp(autoPerc,0.03,0.10);
    const usedPerc=(autoBudget&&autoBudget.checked) ? autoPerc : (Number(manualBudget?.value||7)/100);

    const budget=income*usedPerc, rangeMin=income*0.03, rangeMax=income*0.10;
    const years=dependents>=2?5:3; const lifeBase=roundTo(debt+(annual*years),50000);
    let lifeA=roundTo(lifeBase*0.75,50000), lifeB=roundTo(lifeBase*1.00,50000), lifeC=roundTo(lifeBase*1.25,50000);
    let ciA=300000, ciB=500000, ciC=1000000; if(age<30){ciA=200000;ciB=400000;ciC=800000;} if(age>=45){ciA=400000;ciB=600000;ciC=1000000;}
    const occBoost=occ==='high'?200000:(occ==='med'?100000:0); let paA=300000+occBoost, paB=500000+occBoost, paC=700000+occBoost;
    let cashA=(hospital==='public')?1000:800, cashB=(hospital==='public')?1500:1200, cashC=(hospital==='public')?2000:1500;

    // mix by priority
    const mix = (priority==='health')? {life:40,ci:35,pa:15,cash:10} : (priority==='savings')? {life:55,ci:20,pa:15,cash:10} : {life:50,ci:25,pa:15,cash:10};

    // Recommend plan by usedPerc
    let rec='B'; if(usedPerc<=0.055) rec='A'; else if(usedPerc>0.085) rec='C';

    // KPIs
    $('#kpiBudget').textContent=fmtTHB(budget);
    $('#kpiPct').textContent=`≈ ${(usedPerc*100).toFixed(1)}% ของรายได้`;
    $('#kpiRange').textContent=`${fmtTHB(rangeMin)} – ${fmtTHB(rangeMax)}`;
    $('#kpiLife').textContent=fmtTHB(lifeBase);

    // Fill compare (hidden initially)
    $('#cmpA_life').textContent=fmtTHB(lifeA); $('#cmpB_life').textContent=fmtTHB(lifeB); $('#cmpC_life').textContent=fmtTHB(lifeC);
    $('#cmpA_ci').textContent=fmtTHB(ciA);   $('#cmpB_ci').textContent=fmtTHB(ciB);   $('#cmpC_ci').textContent=fmtTHB(ciC);
    $('#cmpA_pa').textContent=fmtTHB(paA);   $('#cmpB_pa').textContent=fmtTHB(paB);   $('#cmpC_pa').textContent=fmtTHB(paC);
    $('#cmpA_cash').textContent=cashA.toLocaleString('th-TH')+' บ./วัน'; $('#cmpB_cash').textContent=cashB.toLocaleString('th-TH')+' บ./วัน'; $('#cmpC_cash').textContent=cashC.toLocaleString('th-TH')+' บ./วัน';

    // Render single detail
    const map={A:{life:lifeA,ci:ciA,pa:paA,cash:cashA, name:'แพ็ก A — เริ่มต้น', badge:'งบต่ำ', intro:'โฟกัสปิดหนี้หลักและเหตุหนักก่อน เหมาะกับงบจำกัด'},
               B:{life:lifeB,ci:ciB,pa:paB,cash:cashB, name:'แพ็ก B — สมดุล',    badge:'เหมาะสมตามงบ', intro:'สมดุลคุ้มครอง 4 มิติ: ชีวิต/โรคร้าย/อุบัติเหตุ/รายได้หาย'},
               C:{life:lifeC,ci:ciC,pa:paC,cash:cashC, name:'แพ็ก C — เพิ่มความคุ้มครอง', badge:'งบสูง', intro:'เพิ่มทุน CI และชดเชยรายวันสำหรับความเสี่ยงระยะยาว'} };
    const M=map[rec];

    $('#det_planName').textContent=M.name; $('#det_badge').textContent=M.badge; $('#det_intro').textContent=M.intro;
    $('#det_budget').textContent=fmtTHB(budget); $('#det_budgetPct').textContent=`≈ ${(usedPerc*100).toFixed(1)}% ของรายได้`; $('#det_range').textContent=`${fmtTHB(rangeMin)} – ${fmtTHB(rangeMax)}`; $('#det_lifeBase').textContent=fmtTHB(lifeBase);

    // Mix bars
    setBar($('#det_mixLife'), mix.life); setBar($('#det_mixCI'), mix.ci); setBar($('#det_mixPA'), mix.pa); setBar($('#det_mixCash'), mix.cash);
    $('#det_mixLifePct').textContent=mix.life+'%'; $('#det_mixCIPct').textContent=mix.ci+'%'; $('#det_mixPAPct').textContent=mix.pa+'%'; $('#det_mixCashPct').textContent=mix.cash+'%';

    // Cost allocation (approx)
    const cLife=budget*mix.life/100, cCI=budget*mix.ci/100, cPA=budget*mix.pa/100, cCash=budget*mix.cash/100;
    $('#det_costLife').textContent=fmtTHB(cLife); $('#det_costCI').textContent=fmtTHB(cCI); $('#det_costPA').textContent=fmtTHB(cPA); $('#det_costCash').textContent=fmtTHB(cCash);

    // Coverage values
    $('#det_life').textContent=fmtTHB(M.life); $('#det_ci').textContent=fmtTHB(M.ci); $('#det_pa').textContent=fmtTHB(M.pa); $('#det_cash').textContent=M.cash.toLocaleString('th-TH')+' บ./วัน';

    // Hints list (tailored)
    const hints=[]; const publicHosp=(hospital==='public');
    hints.push(publicHosp? 'ใช้สิทธิ รพ.รัฐ → เน้นเงินชดเชยรายวันช่วยรายได้หาย' : 'ใช้ รพ.เอกชน → ตรวจวงเงินค่าห้อง IPD ของโรงพยาบาลเป้าหมาย');
    if(dependents>0) hints.push('มีผู้อยู่ในอุปการะ → ดันทุนชีวิตให้ ≥ หนี้รวม + ค่าใช้จ่าย 2–3 ปี');
    if(occ!=='low') hints.push('งานเสี่ยง → เพิ่ม PA และอ่านข้อยกเว้นอาชีพ');
    hints.push( smoker? 'สูบบุหรี่ → เบี้ยอาจสูง ควรตรวจสุขภาพก่อนทำ':'ไม่สูบ → เงื่อนไขเบื้องต้นมักดีกว่ากลุ่มสูบ');
    if(income<=20000) hints.push('ควบคุมงบที่ 5–10% ของรายได้/เดือน แล้วค่อยเพิ่มเมื่อรายได้เติบโต');
    $('#det_hint').innerHTML = hints.map(x=>`<li>${x}</li>`).join('');

    // Summary for copy/share
    const summary=[
      `${M.name} — ${M.badge}`,
      `งบ/เดือน: ${fmtTHB(budget)} (≈ ${(usedPerc*100).toFixed(1)}% ของรายได้; ช่วงอ้างอิง ${fmtTHB(rangeMin)}–${fmtTHB(rangeMax)})`,
      `ทุนชีวิตฐาน: ${fmtTHB(lifeBase)}`,
      `คุ้มครอง: Life ${fmtTHB(M.life)} | CI ${fmtTHB(M.ci)} | PA ${fmtTHB(M.pa)} | Cash ${M.cash.toLocaleString('th-TH')} บ./วัน`,
      `สัดส่วนเบี้ยโดยประมาณ: Life ${mix.life}% | CI ${mix.ci}% | PA ${mix.pa}% | Cash ${mix.cash}%`,
      `หมายเหตุ: ใช้เพื่อประกอบการตัดสินใจเบื้องต้น ไม่ใช่ใบเสนอราคา — สอบถามเพจ GG‑NinePlanner`
    ].join('\n');
    document.body.dataset.summary=summary;

    // Plan detail reveal
    show($('#planDetail')); hide($('#compare'));

    if(lastPlan!==rec){ try{ Toast.fire({icon:'info',title:`แนะนำ ${M.name}`}); }catch(_){ console.log('แนะนำ',M.name); } lastPlan=rec; }

    // Save
    save();
  }

  // ===== Buttons =====
  fields.forEach(k=> $('#'+k)?.addEventListener('input', debouncedCalc));
  fields.forEach(k=> $('#'+k)?.addEventListener('change', save));
  $('#calcBtn')?.addEventListener('click', calc);
  $('#mobileCalc')?.addEventListener('click', calc);
  $('#quickCalc')?.addEventListener('click',()=>{ ['age','sex','income','dependents','smoker','occupation','hospital','homeDebt','carDebt','priority'].forEach(()=>{}); const set=(m)=>Object.entries(m).forEach(([k,v])=>{const el=$('#'+k); if(el) el.value=v;}); set({age:38,sex:'male',income:20000,dependents:1,smoker:'no',occupation:'low',hospital:'public',homeDebt:800000,carDebt:250000,priority:'risk'}); calc(); });

  async function doCopy(){ const s=document.body.dataset.summary||''; if(!s){ try{ Toast.fire({icon:'warning',title:'กรอกและคำนวณก่อน'});}catch(_){ alert('กรอกและคำนวณก่อน'); } return; } try{ await navigator.clipboard.writeText(s); Toast.fire({icon:'success',title:'คัดลอกสรุปแล้ว'});}catch(e){ try{ Toast.fire({icon:'error',title:'คัดลอกไม่สำเร็จบนเบราว์เซอร์นี้'});}catch(_){ alert('คัดลอกไม่สำเร็จ'); } } }
  $('#copyBtn')?.addEventListener('click', doCopy);

  async function doShare(){ const s=document.body.dataset.summary||''; if(!s){ try{ Toast.fire({icon:'warning',title:'กรอกและคำนวณก่อน'});}catch(_){ alert('กรอกและคำนวณก่อน'); } return; } if(navigator.share){ try{ await navigator.share({ title:'สรุปแผนคุ้มครอง — GG‑NinePlanner', text:s }); Toast.fire({icon:'success',title:'แชร์แล้ว'});}catch(e){} } else { doCopy(); } }
  $('#shareBtn')?.addEventListener('click', doShare);
  $('#mobileShare')?.addEventListener('click', doShare);

  $('#exportBtn')?.addEventListener('click',()=>{ const data={ fields:Object.fromEntries(fields.map(k=>[k,$('#'+k)?.value])), summary:document.body.dataset.summary||''}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='gg-nineplanner.json'; a.click(); URL.revokeObjectURL(url); try{ Toast.fire({icon:'success',title:'ส่งออกไฟล์ gg-nineplanner.json'});}catch(_){} });

  $('#resetBtn')?.addEventListener('click',()=>{ if(window.Swal){ Swal.fire({ title:'ล้างข้อมูลทั้งหมด?', text:'ค่าที่กรอกและข้อมูลที่บันทึกไว้ในเครื่องจะถูกลบ', icon:'warning', showCancelButton:true, confirmButtonText:'ล้างข้อมูล', cancelButtonText:'ยกเลิก' }).then(r=>{ if(r.isConfirmed){ localStorage.removeItem('ggnp_form'); location.reload(); } }); } else if(confirm('ล้างข้อมูลทั้งหมด?')){ localStorage.removeItem('ggnp_form'); location.reload(); } });
  $('#printBtn')?.addEventListener('click',()=> window.print());

  // Compare toggle
  $('#toggleCompare')?.addEventListener('click',()=>{ const c=$('#compare'); if(c?.classList.contains('hidden')){ c.classList.remove('hidden'); } else { c?.classList.add('hidden'); } });
  $('#btnExpandAll')?.addEventListener('click',()=> $$('details').forEach(d=> d.open=true));
  $('#btnCollapseAll')?.addEventListener('click',()=> $$('details').forEach(d=> d.open=false));

  // Init
  load();
  if($('#age')?.value && $('#income')?.value){ calc(); }
})();
