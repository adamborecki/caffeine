'use strict';
const KEY='caffeine-planner-v2';
const KA=3; // absorption rate per hour; peak lands roughly 1 h after a dose
const X0=4,X1=32; // chart spans 4am today to 8am tomorrow
const PALETTE=['#eb6834','#1baf7a','#2a78d6','#c03f8c','#b8860b','#0f9fb0','#8a5a2b','#7a7a00'];
const CELSIUS_PER_OZ=200/12;

// Preset library: mg per typical serving. perOz drinks get a pour-size slider instead of mg.
const LIB=[
  {name:'Yogi Sweet Tangerine Positive Energy tea',mg:70},
  {name:'Green tea, lemon & ginger',mg:30},
  {name:'Moroccan mint green tea',mg:30},
  {name:'Celsius (small pour)',perOz:CELSIUS_PER_OZ,oz:3},
  {name:'Celsius (12 oz can)',mg:200},
  {name:'Preworkout (1 scoop)',mg:200},
  {name:'Preworkout stick',mg:100},
  {name:'Celsius (half can)',mg:100},
  {name:'Coffee, brewed (8 oz)',mg:95},
  {name:'Espresso (1 shot)',mg:64},
  {name:'Cold brew (12 oz)',mg:150},
  {name:'Black tea (8 oz)',mg:48},
  {name:'Green tea (8 oz)',mg:29},
  {name:'Matcha (1 tsp)',mg:70},
  {name:'Cola (12 oz)',mg:33},
  {name:'Energy drink (8 oz)',mg:80},
  {name:'Dark chocolate (1 oz)',mg:23},
  {name:'Decaf coffee (8 oz)',mg:2}
];

const h=(hr,min=0)=>hr+min/60;
const SENS={sensitive:{label:'Sensitive',thr:25},medium:{label:'Medium',thr:50},low:{label:'Not very',thr:100}};
const HL={fast:{label:'Fast',hl:3.5},avg:{label:'Average',hl:5},slow:{label:'Lingers',hl:7}};

// Adam's routine, shown to first-time visitors as an example until they press "Make it mine".
function defaults(){
  return {v:2,profile:'example',hl:5,bed:24,wake:h(7,50),thr:60,repeat:true,custom:[],entries:[
    {name:'Yogi Sweet Tangerine Positive Energy tea',mg:70,t:h(8,15),on:true},
    {name:'Green tea, lemon & ginger',mg:30,t:h(12,30),on:true},
    {name:'Celsius (small pour)',perOz:CELSIUS_PER_OZ,oz:3,t:14,on:false},
    {name:'Preworkout (1 scoop)',mg:200,t:15,on:false},
    {name:'Moroccan mint green tea',mg:30,t:16,on:true}
  ].map(withId)};
}

let nextId=1;
function withId(e){return {...e,id:nextId++}}
const num=(v,lo,hi,d)=>{v=+v;return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d};

// Accept anything (saved state, imported file) and return a clean state object.
function normalize(o){
  const D=defaults();
  if(!o||typeof o!=='object')return D;
  // Saved state from before profiles existed is the owner's own data; bump the old 25 mg default to 60.
  const legacy=!('profile' in o);
  const S={v:2,profile:o.profile==='example'?'example':'mine',
    hl:num(o.hl,2,12,D.hl),bed:num(o.bed,20,27,D.bed),wake:num(o.wake,5,12,D.wake),
    thr:legacy&&o.thr===25?60:num(o.thr,0,150,D.thr),repeat:o.repeat===undefined?D.repeat:!!o.repeat,
    custom:Array.isArray(o.custom)?o.custom.filter(c=>c&&typeof c.name==='string').map(c=>({name:c.name.slice(0,60),mg:num(c.mg,0,1000,0)})):[],
    entries:[]};
  if(Array.isArray(o.entries)){
    S.entries=o.entries.filter(e=>e&&typeof e.name==='string').slice(0,30).map(e=>{
      const x={name:e.name.slice(0,60),t:num(e.t,5,23.5,12),on:e.on!==false};
      if(e.perOz){x.perOz=num(e.perOz,0.1,100,CELSIUS_PER_OZ);x.oz=num(e.oz,0.5,16,3)}else x.mg=num(e.mg,0,1000,0);
      return withId(x);
    });
  }else S.entries=D.entries;
  return S;
}

let S;
try{S=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch(e){S=defaults()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

const $=id=>document.getElementById(id);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmt(x){x=((x%24)+24)%24;let H=Math.floor(x),M=Math.round((x-H)*60);if(M===60){H+=1;M=0}H%=24;return (H%12||12)+(M?':'+String(M).padStart(2,'0'):'')+(H>=12?'pm':'am')}
const colorOf=e=>PALETTE[S.entries.indexOf(e)%PALETTE.length];
const mgOf=e=>e.perOz?Math.round(e.perOz*e.oz):e.mg;

// Amount (mg) left in the body dt hours after taking `mg`.
function amt(mg,dt,ke){return dt<=0?0:mg*KA/(KA-ke)*(Math.exp(-ke*dt)-Math.exp(-KA*dt))}
// One drink's contribution at time t, including the same drink on the two previous days if repeating.
function one(e,t,ke,force){
  if(!e.on&&!force)return 0;
  const m=mgOf(e);let s=amt(m,t-e.t,ke);
  if(S.repeat)s+=amt(m,t-e.t+24,ke)+amt(m,t-e.t+48,ke);
  return s;
}
const total=(t,ke)=>S.entries.reduce((s,e)=>s+one(e,t,ke),0);

// Latest time this drink could be taken (same dose) and still be at/below the comfort level at bedtime.
function cutoff(e,ke){
  if(mgOf(e)===0)return {state:'zero'};
  const base=S.entries.reduce((s,o)=>o===e?s:s+one(o,S.bed,ke),0);
  if(base>S.thr)return {state:'others'};
  let best=null;
  // Contribution at bedtime rises as the dose moves later, until it's within ~1.5 h of bed (still absorbing).
  for(let m=300;m/60<=Math.min(23.5,S.bed-1.5)+1e-9;m+=15){
    if(base+one({...e,t:m/60},S.bed,ke,true)<=S.thr)best=m/60;else break;
  }
  return best===null?{state:'never'}:{state:'ok',t:best};
}
function nowHour(){const d=new Date();let x=d.getHours()+d.getMinutes()/60;if(x<X0)x+=24;return x}

// ---------- drink list ----------
function doseControl(e){
  return e.perOz
    ?'<span class="k">Pour</span><input type="range" class="dose" min="0.5" max="16" step="0.5" value="'+e.oz+'"><span class="v"></span>'
    :'<span class="k">Dose</span><input type="range" class="dose" min="0" max="400" step="5" value="'+e.mg+'"><span class="v"></span>';
}
function renderList(){
  $('drinks').innerHTML=S.entries.map(e=>
    '<div class="row'+(e.on?'':' off')+'" data-id="'+e.id+'">'+
      '<div class="hd"><input type="checkbox" class="on" aria-label="Include '+esc(e.name)+'"'+(e.on?' checked':'')+'>'+
      '<span class="sw" style="background:'+colorOf(e)+'"></span>'+
      '<input class="name" value="'+esc(e.name)+'" maxlength="60" aria-label="Drink name">'+
      '<button class="ib dup" type="button" title="Duplicate" aria-label="Duplicate">⧉</button>'+
      '<button class="ib del" type="button" title="Remove" aria-label="Remove">✕</button></div>'+
      '<div class="ln">'+doseControl(e)+'</div>'+
      '<div class="ln"><span class="k">Time</span><input type="range" class="time" min="300" max="1410" step="15" value="'+Math.round(e.t*60)+'"><span class="v"></span></div>'+
      '<div class="cut"></div>'+
    '</div>').join('')||'<p class="sub">No drinks yet. Add one below.</p>';
}
function renderLibrary(){
  $('lib').innerHTML=LIB.map((d,i)=>'<button type="button" class="chip" data-lib="'+i+'">'+esc(d.name)+' <i>'+(d.perOz?Math.round(d.perOz)+' mg/oz':d.mg+' mg')+'</i></button>').join('');
  $('mineWrap').hidden=!S.custom.length;
  $('mine').innerHTML=S.custom.map((d,i)=>'<span class="chip" data-mine="'+i+'" role="button" tabindex="0">'+esc(d.name)+' <i>'+d.mg+' mg</i><span class="x" data-delmine="'+i+'" title="Remove from my drinks" aria-label="Remove '+esc(d.name)+' from my drinks">×</span></span>').join('');
}
function addEntry(d){
  const n=nowHour();
  const t=n>=5&&n<=23.5?Math.round(n*4)/4:12;
  const e=withId(d.perOz?{name:d.name,perOz:d.perOz,oz:d.oz,t,on:true}:{name:d.name,mg:d.mg,t,on:true});
  S.entries.push(e);
  S.entries.sort((a,b)=>a.t-b.t);
  renderList();update();
}
const rowEntry=el=>{const r=el.closest('.row[data-id]');return r&&S.entries.find(e=>e.id===+r.dataset.id)};

$('drinks').addEventListener('input',ev=>{
  const e=rowEntry(ev.target);if(!e)return;
  const c=ev.target.classList;
  if(c.contains('on')){e.on=ev.target.checked;ev.target.closest('.row').classList.toggle('off',!e.on)}
  else if(c.contains('dose')){if(e.perOz)e.oz=+ev.target.value;else e.mg=+ev.target.value}
  else if(c.contains('time'))e.t=+ev.target.value/60;
  else if(c.contains('name'))e.name=ev.target.value.slice(0,60);
  update();
});
$('drinks').addEventListener('click',ev=>{
  const e=rowEntry(ev.target);if(!e)return;
  if(ev.target.classList.contains('del')){S.entries=S.entries.filter(x=>x!==e);renderList();update()}
  else if(ev.target.classList.contains('dup')){const c=withId({...e});c.t=Math.min(23.5,e.t+1);S.entries.splice(S.entries.indexOf(e)+1,0,c);renderList();update()}
});
$('lib').addEventListener('click',ev=>{const b=ev.target.closest('[data-lib]');if(b)addEntry(LIB[+b.dataset.lib])});
function mineAction(ev){
  const x=ev.target.closest('[data-delmine]');
  if(x){S.custom.splice(+x.dataset.delmine,1);renderLibrary();save();return}
  const b=ev.target.closest('[data-mine]');if(b)addEntry(S.custom[+b.dataset.mine]);
}
$('mine').addEventListener('click',mineAction);
$('mine').addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();mineAction(ev)}});
$('customForm').addEventListener('submit',ev=>{
  ev.preventDefault();
  const f=ev.target,name=f.elements.name.value.trim().slice(0,60),mg=num(f.elements.mg.value,0,1000,0);
  if(!name)return;
  if(!S.custom.some(c=>c.name===name&&c.mg===mg))S.custom.push({name,mg});
  f.reset();renderLibrary();addEntry({name,mg});
});

// ---------- chart ----------
const xs=[];for(let t=X0;t<=X1+1e-9;t+=0.25)xs.push(Math.round(t*100)/100);
const markers={id:'markers',
  beforeDatasetsDraw(ch){ // shaded sleep window
    const x=ch.scales.x,a=ch.chartArea,c=ch.ctx,x0=x.getPixelForValue(S.bed),x1=x.getPixelForValue(Math.min(X1,S.wake+24));
    c.save();c.fillStyle=css('--sleep');c.fillRect(x0,a.top,x1-x0,a.bottom-a.top);c.restore();
  },
  afterDatasetsDraw(ch){
    const x=ch.scales.x,a=ch.chartArea,c=ch.ctx;
    const line=(v,color,label,align,bottom)=>{
      if(v<X0||v>X1)return;const px=x.getPixelForValue(v);
      c.save();c.strokeStyle=color;c.lineWidth=1.5;c.setLineDash([4,3]);
      c.beginPath();c.moveTo(px,a.top);c.lineTo(px,a.bottom);c.stroke();
      c.fillStyle=color;c.font='11px system-ui,sans-serif';c.textAlign=align;c.fillText(label,px+(align==='right'?-4:4),bottom?a.bottom-4:a.top+11);c.restore();
    };
    line(S.bed,css('--accent'),'Bed','right');
    line(S.wake+24,css('--accent'),'Wake','right');
    line(nowHour(),css('--now'),'Now','left',true);
  }};
const chart=new Chart($('c'),{type:'line',data:{datasets:[]},
  options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{filter:i=>i.datasetIndex<i.chart.data.datasets.length-1,
      callbacks:{title:i=>fmt(i[0].parsed.x),label:i=>i.dataset.label+': '+Math.round(i.parsed.y)+' mg'}}},
    scales:{
      x:{type:'linear',min:X0,max:X1,ticks:{stepSize:4,color:'#898781',font:{size:11},callback:v=>fmt(v)},grid:{display:false}},
      y:{min:0,suggestedMax:50,ticks:{color:'#898781',font:{size:11}},grid:{}}
    }},
  plugins:[markers]});
// Touch screens never send "mouseout", so the tooltip would stay up forever. Hide it shortly after the finger lifts.
let tipTimer;
const hideTip=()=>{chart.setActiveElements([]);chart.tooltip.setActiveElements([],{x:0,y:0});chart.update('none')};
['touchend','touchcancel'].forEach(t=>$('c').addEventListener(t,()=>{clearTimeout(tipTimer);tipTimer=setTimeout(hideTip,1500)},{passive:true}));
$('c').addEventListener('touchstart',()=>clearTimeout(tipTimer),{passive:true});

// ---------- settings ----------
const settings=[['hl',v=>v,v=>v+' h'],['bed',v=>v/60,v=>fmt(v)],['wake',v=>v/60,v=>fmt(v)],['thr',v=>v,v=>v+' mg']];
function syncSettings(){
  $('hl').value=S.hl;$('bed').value=Math.round(S.bed*60);$('wake').value=Math.round(S.wake*60);$('thr').value=S.thr;$('repeat').checked=S.repeat;
}
settings.forEach(([id,parse])=>$(id).addEventListener('input',ev=>{S[id]=parse(+ev.target.value);update()}));
$('repeat').addEventListener('change',ev=>{S.repeat=ev.target.checked;update()});
$('sensSeg').innerHTML=Object.entries(SENS).map(([k,v])=>'<button type="button" data-thr="'+v.thr+'">'+v.label+' · '+v.thr+'</button>').join('');
$('hlSeg').innerHTML=Object.entries(HL).map(([k,v])=>'<button type="button" data-hl="'+v.hl+'">'+v.label+' · '+v.hl+'h</button>').join('');
$('sensSeg').addEventListener('click',ev=>{const b=ev.target.closest('[data-thr]');if(b){S.thr=+b.dataset.thr;syncSettings();update()}});
$('hlSeg').addEventListener('click',ev=>{const b=ev.target.closest('[data-hl]');if(b){S.hl=+b.dataset.hl;syncSettings();update()}});

// ---------- example vs. mine ----------
const toHours=v=>{const [H,M]=String(v).split(':').map(Number);return Number.isFinite(H)?H+(M||0)/60:null};
$('mineBtn').addEventListener('click',()=>$('mineDlg').showModal());
$('mineDlg').addEventListener('close',()=>{
  if($('mineDlg').returnValue!=='ok')return;
  const f=$('mineForm').elements;
  let bed=toHours(f.bed.value),wake=toHours(f.wake.value);
  if(bed===null)bed=23;else if(bed<12)bed+=24; // after-midnight bedtimes
  S={...S,profile:'mine',thr:SENS[f.sens.value].thr,hl:HL[f.hl.value].hl,
    bed:num(bed,20,27,23),wake:num(wake,5,12,7),
    entries:f.start.value==='copy'?S.entries.map(e=>({...e})):[]};
  refresh();
});

// ---------- main update ----------
function update(){
  const ke=Math.LN2/S.hl;
  settings.forEach(([id,,show])=>$(id+'v').textContent=show(S[id]));
  $('banner').hidden=S.profile!=='example';
  document.querySelectorAll('#sensSeg button').forEach(b=>b.classList.toggle('on',+b.dataset.thr===S.thr));
  document.querySelectorAll('#hlSeg button').forEach(b=>b.classList.toggle('on',+b.dataset.hl===S.hl));

  // per-drink labels
  S.entries.forEach(e=>{
    const r=document.querySelector('.row[data-id="'+e.id+'"]');if(!r)return;
    r.querySelector('.dose+.v').textContent=e.perOz?e.oz+' oz · '+mgOf(e)+' mg':e.mg+' mg';
    r.querySelector('.time+.v').textContent=fmt(e.t);
    const c=cutoff(e,ke),cut=r.querySelector('.cut');let txt='',warn=false;
    if(c.state==='ok'){
      txt=c.t>=Math.min(23.5,S.bed-1.5)?'Fine at any time up to '+fmt(c.t)+' for your bedtime level.':'Latest time for a clear bedtime: '+fmt(c.t)+'.';
      if(e.on&&e.t>c.t+1e-9){txt+=' You\'re past it.';warn=true}
    }else if(c.state==='others'){txt='Your other drinks already put you over at bedtime.';warn=e.on}
    else if(c.state==='never'){txt='This dose alone keeps you over your bedtime level at any time today.';warn=e.on}
    cut.textContent=txt;cut.classList.toggle('warn',warn);
  });

  // chart
  const line=css('--ink');
  chart.data.datasets=[
    ...S.entries.filter(e=>e.on).map(e=>({label:e.name,data:xs.map(t=>({x:t,y:Math.round(one(e,t,ke)*10)/10})),borderColor:colorOf(e),borderWidth:1.5,borderDash:[5,3],pointRadius:0,tension:.25})),
    {label:'Total',data:xs.map(t=>({x:t,y:Math.round(total(t,ke)*10)/10})),borderColor:line,borderWidth:2.5,pointRadius:0,tension:.25},
    {label:'OK at bed',data:[{x:X0,y:S.thr},{x:X1,y:S.thr}],borderColor:'#898781',borderWidth:1,borderDash:[2,4],pointRadius:0}
  ];
  chart.options.scales.y.grid.color=css('--grid');
  chart.update('none');
  $('legend').innerHTML=S.entries.filter(e=>e.on).map(e=>'<span><i class="sw" style="background:'+colorOf(e)+'"></i>'+esc(e.name)+'</span>').join('')+
    '<span><i class="sw" style="background:var(--ink)"></i>Total</span><span><i class="sw" style="background:var(--sleep);border:1px solid var(--accent)"></i>Sleep</span>';

  // metrics
  const bedMg=Math.round(total(S.bed,ke));
  $('mNow').textContent=Math.round(total(nowHour(),ke))+' mg';
  $('mBed').textContent=bedMg+' mg';
  $('mWake').textContent=Math.round(total(S.wake+24,ke))+' mg';
  const act=S.entries.filter(e=>e.on&&mgOf(e)>0);
  let safe='-';
  if(act.length){
    const last=Math.max(...act.map(e=>e.t));let found=null;
    for(let t=last+1;t<=last+48;t+=0.05){if(total(t,ke)<=S.thr){found=t;break}}
    safe=found===null?'Not within 2 days':fmt(found)+(found>S.wake+24?' tmrw':'');
  }
  $('mSafe').textContent=safe;
  const v=$('verdict');
  if(!act.length){v.style.color='var(--sub)';v.textContent='No drinks switched on.'}
  else if(bedMg<=S.thr){v.style.color='var(--ok)';v.textContent='Clear at bedtime. Active caffeine is at or under your '+S.thr+' mg level.'}
  else{v.style.color='var(--warn)';v.textContent=(bedMg-S.thr)+' mg over your level at bedtime. Try an earlier last drink, a smaller one, or a later bedtime. Each drink shows its latest clear time below.'}

  const day=act.reduce((s,e)=>s+mgOf(e),0);
  $('daily').textContent='Today: '+day+' mg total. The FDA says up to about 400 mg a day is generally fine for healthy adults (under 200 mg if pregnant).';
  $('dailyBar').firstElementChild.style.width=Math.min(100,day/4)+'%';
  $('dailyBar').classList.toggle('over',day>400);
  save();
}

// ---------- data ----------
$('exportBtn').addEventListener('click',()=>{
  const out={...S,entries:S.entries.map(({id,...e})=>e)};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
  a.download='caffeine-planner-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async ev=>{
  const f=ev.target.files[0];ev.target.value='';if(!f)return;
  try{S=normalize(JSON.parse(await f.text()));refresh()}catch(e){alert('That file isn\'t valid planner JSON.')}
});
$('resetBtn').addEventListener('click',()=>{if(confirm('Erase your drinks and settings and go back to the example?')){S=defaults();refresh()}});

function refresh(){syncSettings();renderList();renderLibrary();update()}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',update);
setInterval(update,60000);
refresh();
