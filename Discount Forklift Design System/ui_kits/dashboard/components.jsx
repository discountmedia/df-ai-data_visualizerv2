/* Shared primitives + helpers for the dashboard UI kit. */
const { useState, useMemo } = React;

function fmt(n){ if(n==null||Number.isNaN(n)) return "—"; return n.toLocaleString("en-US"); }
function fmtMoney(n){
  if(n==null||Number.isNaN(n)) return "—";
  if(Math.abs(n)>=1e6) return "$"+(n/1e6).toFixed(2)+"M";
  if(Math.abs(n)>=1e3) return "$"+(n/1e3).toFixed(1)+"K";
  return "$"+Math.round(n).toLocaleString("en-US");
}
function cn(...p){ return p.filter(Boolean).join(" "); }

function Eyebrow({ children, style }){ return <p className="eyebrow" style={{margin:0,...style}}>{children}</p>; }

function Pill({ map, k, label }){
  const v = map[k];
  if(!v || k==="unknown") return <span className="faint">—</span>;
  return <span className="pill" style={{ color:v.c, borderColor:v.b, background:v.bg||"transparent", fontWeight:v.bg?700:400 }}>{label}</span>;
}
function WorkPill({ work }){ return work==="unknown" ? <span className="faint">—</span> : <Pill map={WORK_PILL} k={work} label={WORK_LABEL[work]} />; }
function SalePill({ sale }){ return sale==="unknown" ? <span className="faint">—</span> : <Pill map={SALE_PILL} k={sale} label={SALE_LABEL[sale]} />; }
function TierPill({ tier }){ return <Pill map={TIER_PILL} k={tier} label={TIER_LABEL[tier]} />; }

function MetricCard({ label, value, accent="var(--ink)", subtext, big=44 }){
  return (
    <div className="card card-hover" style={{padding:16,display:"flex",flexDirection:"column",minHeight:118}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
        <p className="eyebrow" style={{margin:0,lineHeight:1.3}}>{label}</p><span className="faint" style={{flexShrink:0}}>→</span>
      </div>
      <p className="df-display" style={{margin:"auto 0 0",paddingTop:10,fontSize:big,color:accent}}>{value}</p>
      <p style={{margin:"7px 0 0",fontSize:11,color:"var(--ink-faint)"}}>{subtext||""}</p>
    </div>
  );
}

function WorkStatusPill({ ws }){
  if(!ws) return <span className="faint">—</span>;
  return <span className={cn("ws","ws-"+ws.mode)}><b>{ws.code}</b><span>{ws.label}</span></span>;
}
function SaleTypeCell({ sale }){
  if(!sale||sale==="unknown") return <span className="faint">—</span>;
  const v = SALE_PILL[sale];
  return <span className="sale-pill" style={{color:v.c,border:`1px solid ${v.b}`}}>{SALE_LABEL[sale]}</span>;
}

function DistributionBar({ segments, legend }){
  const sum = segments.reduce((s,x)=>s+x.value,0) || 1;
  return (
    <div>
      <div style={{display:"flex",height:8,borderRadius:3,overflow:"hidden",background:"rgba(42,42,46,.4)"}}>
        {segments.map(s=> s.value>0 ? <div key={s.label} style={{width:`${s.value/sum*100}%`,background:s.color}} title={`${s.label}: ${s.value}`} /> : null)}
      </div>
      {legend && (
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginTop:10,fontSize:10,color:"var(--ink-dim)"}}>
          {segments.map(s=>(
            <span key={s.label} style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{width:8,height:8,background:s.color}} />{s.label}
              <span className="nums" style={{color:"var(--ink)"}}>{fmt(s.value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* horizontal labeled bar chart (no pie charts!) */
function BarsH({ data, color }){
  const max = Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {data.map(d=>(
        <div key={d.name} style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:96,fontSize:11,color:"var(--ink-dim)",textAlign:"right",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.name}</span>
          <div style={{flex:1,height:14,background:"rgba(42,42,46,.4)",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${d.value/max*100}%`,background:d.color||color||"#3aa0ff",borderRadius:"0 2px 2px 0"}} />
          </div>
          <span className="nums" style={{width:34,fontSize:11,color:"var(--ink)",textAlign:"right"}}>{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* vertical bar chart */
function BarsV({ data }){
  const max = Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:12,height:170,padding:"0 4px"}}>
      {data.map(d=>(
        <div key={d.name} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,height:"100%",justifyContent:"flex-end"}}>
          <span className="nums" style={{fontSize:11,color:"var(--ink)"}}>{fmt(d.value)}</span>
          <div style={{width:"100%",maxWidth:46,height:`${d.value/max*100}%`,background:d.color,borderRadius:"2px 2px 0 0",minHeight:2}} />
          <span style={{fontSize:10,color:"var(--ink-dim)",textAlign:"center",lineHeight:1.2}}>{d.name}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, hint, children, style }){
  return (
    <section className="card" style={{padding:16,...style}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <Eyebrow>{title}</Eyebrow>{hint && <span style={{fontSize:10,color:"var(--ink-faint)"}}>{hint}</span>}
      </div>
      <div style={{marginTop:14}}>{children}</div>
    </section>
  );
}

/* deterministic priority scoring — mirrors lib/score.ts intent */
function scoreUnits(units){
  const ranked = [];
  for(const u of units){
    const factors=[];
    if(u.work==="sold" && u.committed && !u.signed){ factors.push({label:"Committed, unsigned",detail:"Customer paid/committed, no signature on file",points:55}); }
    if(u.committed && (u.work==="working"||u.work==="needs_diagnosis")){ factors.push({label:"Open work on sold",detail:"Revenue stuck until finished",points:40}); }
    if(u.work==="needs_diagnosis"){ factors.push({label:"Needs diagnosis",detail:"Cannot be worked until diagnosed",points:25}); }
    if(u.work==="working"){ factors.push({label:"In service",detail:"Active work-in-progress",points:12}); }
    if(u.sale==="down_payment" && !u.signed){ factors.push({label:"Down payment open",detail:"Deposit received, deal not closed",points:18}); }
    if(factors.length===0) continue;
    let raw = factors.reduce((s,f)=>s+f.points,0);
    const score = Math.min(100,raw);
    const tier = score>=70?"act_now":score>=45?"high":score>=25?"medium":"low";
    const action = u.work==="sold"&&!u.signed ? "Chase signature — deal not closed"
      : u.work==="needs_diagnosis" ? "Diagnose before any work"
      : u.committed ? "Finish work — revenue is stuck"
      : "Move to ready";
    ranked.push({ unit:u, score, tier, action, factors });
  }
  ranked.sort((a,b)=> b.score-a.score || a.unit.rowIndex-b.unit.rowIndex);
  const tierCounts={act_now:0,high:0,medium:0,low:0};
  ranked.forEach(s=>tierCounts[s.tier]++);
  return { ranked, tierCounts, scoredCount:ranked.length, totalUnits:units.length };
}

Object.assign(window, { fmt, fmtMoney, cn, Eyebrow, Pill, WorkPill, SalePill, TierPill, MetricCard, WorkStatusPill, SaleTypeCell, DistributionBar, BarsH, BarsV, Panel, scoreUnits });
