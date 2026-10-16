# Caffeine & Sleep Planner: project handoff

Paste this into a coding session (Claude Code or similar) to continue. It is self-contained: context, decisions, the math, a roadmap, and a working reference implementation.

## 1. Context

I'm building a small web app to visualize how caffeine from different drinks decays through the day and whether it will interfere with sleep. It began as a vague "gamified real-life RPG / personal religion / dopamine calculator" idea. I narrowed it to the one part with real math behind it: caffeine, sleep, and exercise timing. The RPG layer is optional and comes last.

Goals:
- Fun, useful personal tool I actually use.
- A first vibecoding project, so keep it small and shippable.
- Public GitHub repo, hosted free on GitHub Pages.
- Possibly usable by other people later, so the design must not assume it's only for me.

## 2. Decisions already made

- Single-page static app: plain HTML, CSS, JS, plus Chart.js from a CDN. No framework, no build step, no backend.
- Data stays in `localStorage`. No accounts, no server, no analytics. This avoids privacy and liability issues.
- Educational framing only. No medical claims.
- Don't call it a "dopamine calculator" in the UI. That is not measurable and is scientifically shaky (see section 4). Use "energy and sleep planner" or similar.
- Start with a utility, not a game. Skip game graphics until I've used the tool for at least 2 weeks.

## 3. The model

One-compartment pharmacokinetics with first-order absorption and first-order elimination:

```
ke = ln(2) / halfLifeHours
ka = 3 per hour   (absorption, peak at ~45 min)
C(t) = dose * ka / (ka - ke) * (exp(-ke * dt) - exp(-ka * dt)),  dt = t - doseTime, 0 if dt <= 0
total(t) = sum of C(t) over all enabled drinks
```

The "mg" values are mg of caffeine in the body, not blood concentration. There is no volume of distribution, so it's an amount-based approximation.

Derived outputs:
- Active mg at bedtime = `total(bedtime)`.
- "Sleep-safe by" = the first time at least 1 hour after the last dose where `total(t) <= comfortThresholdMg`. Scan in 0.05 h steps.
- Daily total mg compared against the common ~400 mg/day adult guidance (lower, roughly 200 mg, if pregnant).

Defaults:
- Half-life 5 h (real range is roughly 3 to 9 h, varies a lot by person, affected by medications, smoking, oral contraceptives, pregnancy, liver function).
- Bedtime 11pm.
- Comfort threshold 25 mg.
- Sample drinks: coffee 95 mg at 8:00, tangerine energy drink 70 mg at 13:00, preworkout 200 mg at 17:30.

## 4. Scientific honesty constraints (keep these in the UI copy)

- Caffeine acts mainly by blocking adenosine receptors. It is not primarily a "dopamine boost."
- Runner's high is more associated with endocannabinoids than dopamine.
- Cold-plunge dopamine claims trace mostly to one small study. Alertness and mood benefits are plausible, but evidence is thin. Cold immersion carries real cardiac risk for some people.
- Individual half-life is unknown without testing. The app should say so and let users adjust it.
- Nutrition is the riskiest area for liability. Link to reputable sources rather than writing individualized advice.
- Every educational claim should cite a source. Add the disclaimer "Educational only, not medical advice."

## 5. Roadmap (suggested order)

1. Ship the reference implementation below as `index.html` and enable GitHub Pages.
2. Let users add, rename, and delete custom drinks, with a preset library (espresso, cold brew, black tea, green tea, cola, various preworkouts, 70 mg tangerine drink).
3. Multi-day view and a "right now" marker on the chart.
4. Sleep log: bedtime, wake time, quality 1 to 5, plus a note. Store in `localStorage`, export and import as JSON.
5. Correlation view: sleep quality vs. active caffeine at bedtime, and vs. workout timing. Be honest that it needs weeks of data and shows mostly noise early. Show sample size and don't imply causation.
6. Exercise log (lifting, cardio, cold plunge) as simple entries and educational cards.
7. Optional later: light RPG or "character sheet" layer (streaks, stats). Only once the tool is genuinely useful.
8. Optional later: sharing. Needs parameters instead of assumptions, citations on claims, and no accounts.

## 6. Parked ideas (not for this repo's first versions)

- Reward-economy habit system where completing healthy habits "unlocks" indulgences. Design concern: rewards can become the point of the system, so it would need caps, cooldowns, and costs for overuse. Parked, and out of scope for the public repo.
- "Personal religion" framing. Parked as a separate project.

## 7. Repo setup

- Name idea: `caffeine-sleep-planner`.
- Files: `index.html`, `README.md`, `LICENSE` (MIT is fine).
- README should include: what it is, a screenshot, the model in plain English, limitations, the disclaimer, and how to run it (open `index.html`).
- Enable GitHub Pages from the `main` branch root.
- No secrets, no personal data, no analytics.

## 8. Reference implementation: save as `index.html`

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Caffeine and sleep planner</title>
<style>
:root{--bg:#fff;--card:#f6f5f2;--ink:#111;--sub:#555;--muted:#898781;--line:#ddd;--ok:#0a7a3b;--warn:#a15c00;--grid:rgba(137,135,129,.2)}
@media(prefers-color-scheme:dark){:root{--bg:#161615;--card:#222221;--ink:#f0efec;--sub:#b5b4aa;--line:#3a3a38;--ok:#4cc17f;--warn:#e8a43a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:520px;margin:0 auto;padding:16px}
h1{font-size:22px;font-weight:500;margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}
.m{background:var(--card);border-radius:8px;padding:10px 12px}
.m small{display:block;font-size:12px;color:var(--sub)}
.m b{font-size:20px;font-weight:500}
.row{border:.5px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.hd{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500}
.hd label{display:flex;align-items:center;gap:8px;flex:1}
.sw{width:10px;height:10px;border-radius:2px;display:inline-block}
.ln{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub);margin-top:6px}
.ln .k{min-width:56px}
.ln input[type=range]{flex:1;min-width:0}
.ln .v{min-width:56px;text-align:right;color:var(--ink)}
.chart{position:relative;width:100%;height:230px}
#legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--sub);margin-bottom:6px}
#legend span{display:flex;align-items:center;gap:4px}
.fine{font-size:12px;color:var(--muted);margin:10px 0 0;line-height:1.5}
</style>
</head>
<body>
<main>
<h1>Caffeine and sleep planner</h1>
<div class="grid">
  <div class="m"><small>Active at bedtime</small><b id="mBed">0 mg</b></div>
  <div class="m"><small>Sleep-safe by</small><b id="mSafe">-</b></div>
</div>
<div id="verdict" style="font-size:13px;margin-bottom:10px"></div>
<div id="legend"></div>
<div class="chart"><canvas id="c" role="img" aria-label="Caffeine active in the body across the day for each drink and in total, with a sleep threshold and bedtime marker.">Caffeine curves across the day.</canvas></div>

<div style="margin-top:14px">
  <div class="row">
    <div class="hd">Your body and bedtime</div>
    <div class="ln"><span class="k">Half-life</span><input type="range" id="hl" min="3" max="9" step="0.5"><span class="v" id="hlv"></span></div>
    <div class="ln"><span class="k">Bedtime</span><input type="range" id="bed" min="20" max="27" step="0.5"><span class="v" id="bedv"></span></div>
    <div class="ln"><span class="k">Ok at bed</span><input type="range" id="thr" min="0" max="100" step="5"><span class="v" id="thrv"></span></div>
  </div>
  <div id="drinks"></div>
  <div id="daily" style="font-size:13px;color:var(--sub);margin-top:4px"></div>
  <p class="fine">Simple one-compartment model. Half-life varies a lot by person, medication, and pregnancy. Educational only, not medical advice.</p>
</div>
</main>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
const KEY='caffeine-planner-v1';
const KA=3;
const DEFAULTS={hl:5,bed:23,thr:25,drinks:[
 {name:'Coffee',mg:95,t:8,on:true,color:'#2a78d6',dash:[5,3]},
 {name:'Tangerine drink',mg:70,t:13,on:true,color:'#eb6834',dash:[2,3]},
 {name:'Preworkout',mg:200,t:17.5,on:true,color:'#1baf7a',dash:[9,3]}
]};
let S;
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  S=saved&&saved.drinks&&saved.drinks.length===DEFAULTS.drinks.length?saved:structuredClone(DEFAULTS);
}catch(e){S=structuredClone(DEFAULTS)}
S.drinks.forEach((d,i)=>{d.color=DEFAULTS.drinks[i].color;d.dash=DEFAULTS.drinks[i].dash});

const $=id=>document.getElementById(id);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function fmt(h){h=((h%24)+24)%24;let H=Math.floor(h),M=Math.round((h-H)*60);if(M===60){H+=1;M=0}H=H%24;const ap=H>=12?'pm':'am';return (H%12||12)+(M?':'+String(M).padStart(2,'0'):'')+ap}
function one(d,t,ke){if(!d.on||t<=d.t)return 0;const dt=t-d.t;return d.mg*KA/(KA-ke)*(Math.exp(-ke*dt)-Math.exp(-KA*dt))}
function total(t,ke){return S.drinks.reduce((s,d)=>s+one(d,t,ke),0)}

$('hl').value=S.hl;$('bed').value=S.bed;$('thr').value=S.thr;
S.drinks.forEach((d,i)=>{
  const r=document.createElement('div');r.className='row';
  r.innerHTML='<div class="hd"><label><input type="checkbox" id="on'+i+'"'+(d.on?' checked':'')+'><span class="sw" style="background:'+d.color+'"></span>'+d.name+'</label></div>'+
  '<div class="ln"><span class="k">Dose</span><input type="range" id="mg'+i+'" min="0" max="300" step="5" value="'+d.mg+'"><span class="v" id="mgv'+i+'"></span></div>'+
  '<div class="ln"><span class="k">Time</span><input type="range" id="t'+i+'" min="5" max="22" step="0.5" value="'+d.t+'"><span class="v" id="tv'+i+'"></span></div>';
  $('drinks').appendChild(r);
});
$('legend').innerHTML=S.drinks.map(d=>'<span><i class="sw" style="background:'+d.color+'"></i>'+d.name+'</span>').join('')+'<span><i class="sw" style="background:var(--ink)"></i>Total</span>';

const xs=[];for(let t=4;t<=28.001;t+=0.25)xs.push(Math.round(t*100)/100);
const bedPlugin={id:'bed',afterDatasetsDraw(ch){
  const x=ch.scales.x.getPixelForValue(S.bed),a=ch.chartArea,c=ch.ctx;
  c.save();c.strokeStyle='#6250d6';c.lineWidth=1.5;c.setLineDash([4,3]);
  c.beginPath();c.moveTo(x,a.top);c.lineTo(x,a.bottom);c.stroke();c.setLineDash([]);
  c.fillStyle='#6250d6';c.font='11px sans-serif';c.textAlign='right';c.fillText('Bed',x-4,a.top+11);c.restore();
}};
const chart=new Chart($('c'),{type:'line',
  data:{datasets:[
    ...S.drinks.map(d=>({label:d.name,data:[],borderColor:d.color,borderWidth:1.5,borderDash:d.dash,pointRadius:0,tension:.25})),
    {label:'Total',data:[],borderColor:css('--ink'),borderWidth:2.5,pointRadius:0,tension:.25},
    {label:'Threshold',data:[],borderColor:'#898781',borderWidth:1,borderDash:[2,4],pointRadius:0}
  ]},
  options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{callbacks:{title:i=>fmt(i[0].parsed.x),label:i=>i.dataset.label+': '+Math.round(i.parsed.y)+' mg'}}},
    scales:{
      x:{type:'linear',min:4,max:28,ticks:{stepSize:4,color:'#898781',font:{size:11},callback:v=>fmt(v)},grid:{display:false}},
      y:{min:0,ticks:{color:'#898781',font:{size:11}},grid:{color:css('--grid')}}
    }},
  plugins:[bedPlugin]});

function update(){
  S.hl=+$('hl').value;S.bed=+$('bed').value;S.thr=+$('thr').value;
  const ke=Math.LN2/S.hl;
  $('hlv').textContent=S.hl+' h';$('bedv').textContent=fmt(S.bed);$('thrv').textContent=S.thr+' mg';
  S.drinks.forEach((d,i)=>{
    d.on=$('on'+i).checked;d.mg=+$('mg'+i).value;d.t=+$('t'+i).value;
    $('mgv'+i).textContent=d.mg+' mg';$('tv'+i).textContent=fmt(d.t);
    chart.data.datasets[i].data=xs.map(t=>({x:t,y:Math.round(one(d,t,ke)*10)/10}));
  });
  const n=S.drinks.length;
  chart.data.datasets[n].data=xs.map(t=>({x:t,y:Math.round(total(t,ke)*10)/10}));
  chart.data.datasets[n+1].data=[{x:4,y:S.thr},{x:28,y:S.thr}];
  chart.update('none');

  const bedMg=Math.round(total(S.bed,ke));
  $('mBed').textContent=bedMg+' mg';
  const act=S.drinks.filter(d=>d.on&&d.mg>0);
  let safe='-';
  if(act.length){
    const last=Math.max(...act.map(d=>d.t));let found=null;
    for(let t=last+1;t<=48;t+=0.05){if(total(t,ke)<=S.thr){found=t;break}}
    safe=found===null?'Not today':fmt(found);
  }
  $('mSafe').textContent=safe;
  const v=$('verdict');
  if(bedMg<=S.thr){v.style.color='var(--ok)';v.textContent='Clear at bedtime. Active caffeine is under your '+S.thr+' mg comfort level.'}
  else{v.style.color='var(--warn)';v.textContent=(bedMg-S.thr)+' mg over your comfort level at bedtime. Try an earlier last dose, a smaller one, or a later bedtime.'}
  const day=act.reduce((s,d)=>s+d.mg,0);
  $('daily').textContent='Daily total: '+day+' mg. Common adult guidance is up to about 400 mg a day, lower if pregnant.';
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}
}
document.querySelectorAll('input').forEach(e=>e.addEventListener('input',update));
update();
</script>
</body>
</html>
```

## 9. First instructions for the coding session

1. Create the repo structure from section 7 and save the reference implementation as `index.html`.
2. Open it locally and confirm the chart renders, sliders work, and state persists after reload.
3. Write the README (section 7) and add the MIT license.
4. Enable GitHub Pages.
5. Then start on roadmap item 2 (custom drinks and presets). Keep it a single static file unless it gets unwieldy, and ask me before adding a build step or framework.
