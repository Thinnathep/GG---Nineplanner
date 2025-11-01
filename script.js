(function(){
  // ===== Shortcuts =====
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);
  const fmtTHB = (n)=> isNaN(n) ? '—' : new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(n);
  const fmtNum = (n)=> isNaN(n)? 0 : Math.max(0, Math.floor(n));
  const roundTo=(n,step)=>Math.round(n/step)*step;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const fields = ['age','sex','income','dependents','smoker','occupation','hospital','homeDebt','carDebt','priority'];

  // ===== Theme =====
  function applyTheme(pref){
    const root=document.documentElement;
    if(pref==='dark'||(!pref&&window.matchMedia('(prefers-color-scheme: dark)').matches)){
      root.classList.add('dark'); $('#sun')?.classList.remove('hidden'); $('#moon')?.classList.add('hidden');
    } else {
      root.classList.remove('dark'); $('#sun')?.classList.add('hidden'); $('#moon')?.classList.remove('hidden');
    }
  }
  applyTheme(localStorage.getItem('theme'));
  $('#themeBtn')?.addEventListener('click', ()=>{
    const nowDark=!document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', nowDark? 'dark':'light'); applyTheme(localStorage.getItem('theme'));
  });

  // ===== CDN status & SweetAlert2 toast =====
  const hasTw = !!window.tailwind;
  const hasSwal = !!window.Swal;
  const st = $('#cdnStatus'); if(st){ st.classList.remove('hidden'); $('#stTw').textContent=hasTw?'TW✅':'TW❌'; $('#stSwal').textContent=hasSwal?'SW✅':'SW❌'; }
  const Toast = hasSwal ? Swal.mixin({
    toast:true, position:'top-end', showConfirmButton:false, timer:1800, timerProgressBar:true, padding:'10px 14px',
    didOpen:(t)=>{ t.addEventListener('mouseenter',Swal.stopTimer); t.addEventListener('mouseleave',Swal.resumeTimer); }
  }) : { fire: ({icon,title})=>console.log(icon||'info',title||'') };

  // ===== Error catcher =====
  window.addEventListener('error',(e)=>{ try{ Toast.fire({icon:'error',title:'สคริปต์มีปัญหา: '+e.message}); }catch(_){ alert('สคริปต์มีปัญหา: '+e.message); } });

  // ===== Save / Load =====
  function save(){ const data={}; fields.forEach(k=>data[k]=$('#'+k)?.value); localStorage.setItem('ggnp_form', JSON.stringify(data)); }
  function load(){ try{ const d=JSON.parse(localStorage.getItem('ggnp_form')||'{}'); fields.forEach(k=>{ if(d[k]!==undefined&&$('#'+k)) $('#'+k).value=d[k];}); }catch(e){} }

  // ===== Debounce =====
  function debounce(fn,wait=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),wait); }; }
  const debouncedCalc = debounce(calc,150);

  // ===== Animations =====
  function animateNumber(el,to,duration=600){
    if(!el) return; const start=performance.now(); const from=0; const diff=to-from;
    function tick(now){ const p=Math.min(1,(now-start)/duration); el.textContent=fmtTHB(from+diff*p); if(p<1) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }
  function revealCards(){
    ['planA','planB','planC'].forEach((id,i)=>{
      const el=$('#'+id); if(!el) return; el.style.transition='opacity .35s ease, transform .35s ease';
      setTimeout(()=>{ el.style.opacity=1; el.style.transform='translateY(0)'; },80*i);
    });
  }

  // ===== Advanced toggles =====
  const advPanel = $('#advanced');
  $('#toggleAdvanced')?.addEventListener('click',()=> advPanel?.classList.toggle('hidden'));
  const autoBudget = $('#autoBudget');
  const manualBudget = $('#manualBudget');
  const manualBudgetWrap = $('#manualBudgetWrap');
  const manualBudgetPct = $('#manualBudgetPct');
  autoBudget?.addEventListener('change',()=>{ if(manualBudgetWrap) manualBudgetWrap.style.opacity = autoBudget.checked? .5:1; debouncedCalc(); });
  manualBudget?.addEventListener('input',()=>{ if(manualBudgetPct) manualBudgetPct.textContent=manualBudget.value+'%'; debouncedCalc(); });

  // ===== Presets =====
  $$('[data-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const p=btn.dataset.preset;
      if(p==='teacher'){ setVals({age:38, sex:'male', income:20000, dependents:1, smoker:'no', occupation:'low', hospital:'public', homeDebt:800000, carDebt:250000, priority:'risk'}); }
      if(p==='freelance'){ setVals({age:30, sex:'na',   income:15000, dependents:0, smoker:'no', occupation:'med', hospital:'private',homeDebt:0, carDebt:0, priority:'health'}); }
      if(p==='family'){   setVals({age:35, sex:'female',income:22000, dependents:2, smoker:'no', occupation:'low', hospital:'public', homeDebt:600000,carDebt:150000, priority:'risk'}); }
      if(p==='starter'){  setVals({age:28, sex:'na',   income:9000,  dependents:0, smoker:'no', occupation:'med', hospital:'public', homeDebt:0, carDebt:0, priority:'risk'}); }
      calc();
    });
  });
  function setVals(map){ Object.entries(map).forEach(([k,v])=>{ const el=$('#'+k); if(el) el.value=v; }); }

  // ===== Core calc =====
  let lastPlan='';
  function calc(){
    const age=fmtNum(+$('#age')?.value), income=fmtNum(+$('#income')?.value), dependents=fmtNum(+$('#dependents')?.value||0);
    const smoker = ($('#smoker')?.value==='yes'); const occ=$('#occupation')?.value; const hospital=$('#hospital')?.value;
    const homeDebt=fmtNum(+$('#homeDebt')?.value||0), carDebt=fmtNum(+$('#carDebt')?.value||0), priority=$('#priority')?.value;

    let valid=true;
    if(!(age>=18 && age<=70)){ valid=false; $('#age')?.setAttribute('aria-invalid','true'); } else { $('#age')?.removeAttribute('aria-invalid'); }
    if(!(income>0)){ valid=false; $('#income')?.setAttribute('aria-invalid','true'); } else { $('#income')?.removeAttribute('aria-invalid'); }
    if(!valid){ try{ Toast.fire({icon:'error',title:'กรอกอายุ 18–70 ปี และรายได้ต่อเดือนให้ถูกต้อง'});}catch(_){ alert('กรอกข้อมูลให้ครบ'); } return; }

    const annual=income*12, debt=homeDebt+carDebt;
    let autoPerc = income<5000?0.04 : income<10000?0.05 : income<=20000?0.07 : 0.08;
    if(smoker) autoPerc+=0.01; if(dependents>=2) autoPerc+=0.01; if(priority==='health') autoPerc-=0.005; autoPerc=clamp(autoPerc,0.03,0.10);
    const usedPerc = (autoBudget && autoBudget.checked)? autoPerc : (Number(manualBudget?.value||7)/100);

    const budget=income*usedPerc, rangeMin=income*0.03, rangeMax=income*0.10;
    const years=dependents>=2?5:3; let lifeBase=roundTo(debt+(annual*years),50000);
    let lifeA=roundTo(lifeBase*0.75,50000), lifeB=roundTo(lifeBase*1.00,50000), lifeC=roundTo(lifeBase*1.25,50000);
    let ciA=300000, ciB=500000, ciC=1000000; if(age<30){ciA=200000;ciB=400000;ciC=800000;} if(age>=45){ciA=400000;ciB=600000;ciC=1000000;}
    const occBoost=occ==='high'?200000:(occ==='med'?100000:0); let paA=300000+occBoost, paB=500000+occBoost, paC=700000+occBoost;
    let cashA=(hospital==='public')?1000:800, cashB=(hospital==='public')?1500:1200, cashC=(hospital==='public')?2000:1500;

    // bars
    const mix = priority==='health'? {life:40,ci:35,pa:15,cash:10} : priority==='savings'? {life:55,ci:20,pa:15,cash:10} : {life:50,ci:25,pa:15,cash:10};
    if($('#barLife')){ $('#barLife').style.width=mix.life+'%'; $('#pctLife').textContent=mix.life+'%'; }
    if($('#barCI')){ $('#barCI').style.width=mix.ci+'%'; $('#pctCI').textContent=mix.ci+'%'; }
    if($('#barPA')){ $('#barPA').style.width=mix.pa+'%'; $('#pctPA').textContent=mix.pa+'%'; }
    if($('#barCash')){ $('#barCash').style.width=mix.cash+'%'; $('#pctCash').textContent=mix.cash+'%'; }

    // KPIs
    animateNumber($('#kpiBudget'), budget);
    $('#kpiPct').textContent = `≈ ${(usedPerc*100).toFixed(1)}% ของรายได้`;
    $('#kpiRange').textContent = `${fmtTHB(rangeMin)} – ${fmtTHB(rangeMax)}`;
    $('#kpiLife').textContent = fmtTHB(lifeBase);

    // plans
    $('#a_life').textContent=fmtTHB(lifeA); $('#b_life').textContent=fmtTHB(lifeB); $('#c_life').textContent=fmtTHB(lifeC);
    $('#a_ci').textContent=fmtTHB(ciA);   $('#b_ci').textContent=fmtTHB(ciB);   $('#c_ci').textContent=fmtTHB(ciC);
    $('#a_pa').textContent=fmtTHB(paA);   $('#b_pa').textContent=fmtTHB(paB);   $('#c_pa').textContent=fmtTHB(paC);
    $('#a_cash').textContent=cashA.toLocaleString('th-TH')+' บ./วัน'; $('#b_cash').textContent=cashB.toLocaleString('th-TH')+' บ./วัน'; $('#c_cash').textContent=cashC.toLocaleString('th-TH')+' บ./วัน';

    // hints
    const publicHosp=(hospital==='public');
    $('#a_hint').textContent = '• โฟกัสปิดหนี้หลักและเหตุหนักก่อน • ' + (publicHosp? 'ใช้สิทธิ รพ.รัฐ + เสริมชดเชยรายวัน':'ใช้เอกชนบ่อย → พิจารณา IPD ภายหลัง') + (income<10000?' • คุมงบ 3–6% ของรายได้/เดือนก่อน':'');
    const bAdd=[]; if(dependents>0) bAdd.push('เพิ่มทุนชีวิตให้ครอบคลุมผู้พึ่งพิง'); if(occ!=='low') bAdd.push('งานเสี่ยง → เพิ่มทุน PA');
    $('#b_hint').textContent = '• สมดุล ชีวิต/โรคร้าย/อุบัติเหตุ/รายได้หาย' + (bAdd.length? ' • '+bAdd.join(' • '):'');
    const cAdd=[]; if(age>=40) cAdd.push('วัยเสี่ยง NCD → ดัน CI สูงขึ้น');
    $('#c_hint').textContent = '• เพิ่ม CI และเงินชดเชยรายวันสำหรับระยะยาว' + (cAdd.length? ' • '+cAdd.join(' • '):'');

    // advice list
    const tips=[];
    if(dependents>0) tips.push('มีคนพึ่งพิง → ดันทุนชีวิต ≥ หนี้รวม + ค่าใช้จ่าย 2–3 ปี');
    tips.push(publicHosp? 'ใช้ รพ.รัฐบ่อย → Hospital Cash ช่วยชดเชยรายได้' : 'ใช้ รพ.เอกชน → ดูวงเงินค่าห้อง IPD ของโรงพยาบาล');
    if(occ==='high') tips.push('งานภาคสนาม → เพิ่มทุน PA และอ่านข้อยกเว้นอาชีพ');
    tips.push(smoker? 'สูบบุหรี่ → เบี้ยอาจสูงขึ้น ควรตรวจสุขภาพก่อนทำ':'ไม่สูบ → เบี้ยมักดีกว่ากลุ่มสูบ');
    if(income<=20000) tips.push('ควบคุมงบที่ 5–10% ของรายได้/เดือน แล้วค่อยเพิ่มเมื่อรายได้โต');
    $('#advice').innerHTML = tips.map(t=>`<li>${t}</li>`).join('');

    // badge & toast
    function setRecommended(plan){
      ['planA','planB','planC'].forEach(id=> $('#'+id)?.classList.remove('ring-2','ring-brand-500/40'));
      $('#b_badge').textContent='ตัวเลือกกลาง';
      const el = plan==='A'? '#planA' : plan==='B'? '#planB' : '#planC';
      document.querySelector(el)?.classList.add('ring-2','ring-brand-500/40');
      if(plan==='B') $('#b_badge').textContent='เหมาะสมตามงบ';
      if(lastPlan!==plan){ const name= plan==='A'?'แพ็ก A — เริ่มต้น': plan==='B'?'แพ็ก B — สมดุล':'แพ็ก C — เพิ่มความคุ้มครอง'; try{ Toast.fire({icon:'info',title:`แนะนำ ${name}`}); }catch(_){ console.log('แนะนำ',name); } lastPlan=plan; }
    }
    if(usedPerc<=0.055){ setRecommended('A'); } else if(usedPerc<=0.085){ setRecommended('B'); } else { setRecommended('C'); }

    // summary for copy/share
    const summary = [
      `งบแนะนำ/เดือน: ${fmtTHB(budget)} (≈ ${(usedPerc*100).toFixed(1)}% ของรายได้; ช่วงอ้างอิง ${fmtTHB(rangeMin)}–${fmtTHB(rangeMax)})`,
      `ทุนชีวิตฐาน (หนี้รวม + รายได้×${dependents>=2?5:3}ปี): ${fmtTHB(lifeBase)}`,
      `A: Life ${fmtTHB(lifeA)} | CI ${fmtTHB(ciA)} | PA ${fmtTHB(paA)} | Cash ${cashA.toLocaleString('th-TH')} บ./วัน`,
      `B: Life ${fmtTHB(lifeB)} | CI ${fmtTHB(ciB)} | PA ${fmtTHB(paB)} | Cash ${cashB.toLocaleString('th-TH')} บ./วัน`,
      `C: Life ${fmtTHB(lifeC)} | CI ${fmtTHB(ciC)} | PA ${fmtTHB(paC)} | Cash ${cashC.toLocaleString('th-TH')} บ./วัน`,
      `หมายเหตุ: ข้อมูลนี้ใช้เพื่อประกอบการตัดสินใจเบื้องต้น ไม่ใช่ใบเสนอราคา — สอบถามเพจ GG-NinePlanner`
    ].join('\n');
    document.body.dataset.summary = summary;

    save(); revealCards();
  }

  // ===== Events =====
  fields.forEach(k=> $('#'+k)?.addEventListener('input', debouncedCalc));
  fields.forEach(k=> $('#'+k)?.addEventListener('change', save));
  $('#calcBtn')?.addEventListener('click', calc);
  $('#mobileCalc')?.addEventListener('click', calc);
  $('#quickCalc')?.addEventListener('click', ()=>{ setVals({age:38, sex:'male', income:20000, dependents:1, smoker:'no', occupation:'low', hospital:'public', homeDebt:800000, carDebt:250000, priority:'risk'}); calc(); });

  async function doCopy(){
    const s=document.body.dataset.summary||'';
    if(!s){ try{ Toast.fire({icon:'warning',title:'กรอกและคำนวณก่อน'});}catch(_){ alert('กรอกและคำนวณก่อน'); } return; }
    try{ await navigator.clipboard.writeText(s); Toast.fire({icon:'success',title:'คัดลอกสรุปแล้ว'}); }
    catch(e){ try{ Toast.fire({icon:'error',title:'คัดลอกไม่สำเร็จบนเบราว์เซอร์นี้'});}catch(_){ alert('คัดลอกไม่สำเร็จ'); } }
  }
  $('#copyBtn')?.addEventListener('click', doCopy);

  async function doShare(){
    const s=document.body.dataset.summary||''; if(!s){ try{ Toast.fire({icon:'warning',title:'กรอกและคำนวณก่อน'});}catch(_){ alert('กรอกและคำนวณก่อน'); } return; }
    if(navigator.share){ try{ await navigator.share({ title:'สรุปแผนคุ้มครอง — GG-NinePlanner', text:s }); Toast.fire({icon:'success',title:'แชร์แล้ว'}); } catch(e){} }
    else { doCopy(); }
  }
  $('#shareBtn')?.addEventListener('click', doShare);
  $('#mobileShare')?.addEventListener('click', doShare);

  $('#exportBtn')?.addEventListener('click', ()=>{
    const data = { fields: Object.fromEntries(fields.map(k=>[k,$('#'+k)?.value])), summary: document.body.dataset.summary||'' };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='gg-nineplanner.json'; a.click(); URL.revokeObjectURL(url);
    try{ Toast.fire({icon:'success',title:'ส่งออกไฟล์ gg-nineplanner.json'});}catch(_){}
  });

  $('#resetBtn')?.addEventListener('click', ()=>{
    if(window.Swal){
      Swal.fire({ title:'ล้างข้อมูลทั้งหมด?', text:'ค่าที่กรอกและข้อมูลที่บันทึกไว้ในเครื่องจะถูกลบ', icon:'warning', showCancelButton:true, confirmButtonText:'ล้างข้อมูล', cancelButtonText:'ยกเลิก' })
        .then(res=>{ if(res.isConfirmed){ localStorage.removeItem('ggnp_form'); location.reload(); } });
    } else if(confirm('ล้างข้อมูลทั้งหมด?')){ localStorage.removeItem('ggnp_form'); location.reload(); }
  });

  $('#printBtn')?.addEventListener('click', ()=> window.print());

  // ===== Init =====
  load();
  if($('#age')?.value && $('#income')?.value){ calc(); }
})();
