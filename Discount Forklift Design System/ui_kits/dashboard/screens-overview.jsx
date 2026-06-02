/* Dashboard tabs: Overview + All Units. */
const { useState: useStateT, useMemo: useMemoT } = React;

function OverviewAlert({ onView }){
  return (
    <div className="card" style={{position:"relative",borderLeft:"3px solid var(--brand)",
      background:"linear-gradient(90deg, rgba(255,43,43,.14), rgba(255,43,43,.02))",padding:"16px 20px",display:"flex",alignItems:"center",gap:16}}>
      <span style={{fontSize:20,color:"var(--brand)"}}>⚠</span>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:13,fontWeight:700,color:"var(--brand)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{FLEET.openWorkOnSold} sold units still need work completed</p>
        <p style={{margin:"5px 0 0",fontSize:13,color:"var(--ink-dim)"}}>These are paid-in-full or contracted units that haven't been finished. These go first.</p>
      </div>
      <button className="btn" onClick={onView} style={{flexShrink:0,borderColor:"rgba(255,43,43,.4)",color:"var(--ink)"}}>View Now</button>
    </div>
  );
}

function Overview({ loc, onView }){
  const L = loc!=="ALL" ? LOCATIONS.find(l=>l.name.toUpperCase()===loc) : null;
  const stage = L ? { total:L.total, ready:L.ready, working:L.working, needsDiagnosis:L.needs_diagnosis, onRent:L.on_rent, sold:L.sold }
                  : { total:FLEET.total, ready:FLEET.ready, working:FLEET.working, needsDiagnosis:FLEET.needsDiagnosis, onRent:FLEET.onRent, sold:FLEET.sold };

  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:20}}>
      <OverviewAlert onView={onView} />

      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:14}}>
        <MetricCard label="Total Fleet" value={fmt(stage.total)} />
        <MetricCard label="Ready to Sell" value={fmt(stage.ready)} accent="var(--ready)" subtext="Fully prepped" />
        <MetricCard label="Being Worked On" value={fmt(stage.working)} accent="var(--working)" subtext="Service / body" />
        <MetricCard label="Needs Diagnosis" value={fmt(stage.needsDiagnosis)} accent="var(--diag)" subtext="Act first" />
        <MetricCard label="On Rent" value={fmt(stage.onRent)} accent="var(--rent)" subtext="Generating income" />
        <MetricCard label="Sold" value={fmt(stage.sold)} accent="var(--brand)" subtext={`${FLEET.paidInFull} paid full`} />
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:14}}>
        <MetricCard label="Paid in Full" value={fmt(FLEET.paidInFull)} accent="var(--brand)" subtext="Top tier" big={38} />
        <MetricCard label="Down Payment" value={fmt(FLEET.downPayment)} accent="var(--pif)" subtext="Deposit recv'd" big={38} />
        <MetricCard label="Govt PO's" value={fmt(FLEET.govtPo)} accent="var(--govt)" subtext="Contract" big={38} />
        <MetricCard label="Open Work on Sold" value={fmt(FLEET.openWorkOnSold)} accent="var(--diag)" subtext="Fix now" big={38} />
        <MetricCard label="Total Leads" value={fmt(LEADS.total)} subtext="All sources" big={38} />
        <MetricCard label="DFB Leads" value={fmt(LEADS.dfb)} accent="var(--brand)" subtext={`${LEADS.dfbConverted} converted`} big={38} />
        <MetricCard label="Octane Leads" value={fmt(LEADS.octane)} accent="var(--pif)" subtext={`${LEADS.octaneConverted} converted`} big={38} />
        <MetricCard label="Leads Converted" value={fmt(LEADS.converted)} accent="var(--ready)" subtext={`${LEADS.closeRate}% close`} big={38} />
      </div>

      <LocationsSnapshot />
      <ExplainerCards />
    </div>
  );
}

const SEG = [
  { key:"ready", color:"#3ddc84" }, { key:"working", color:"#ffc02e" },
  { key:"needs_diagnosis", color:"#ff3b46" }, { key:"on_rent", color:"#3aa0ff" }, { key:"sold", color:"#ff2b2b" },
];
const SNAP = [
  { key:"ready", label:"Ready", color:"#3ddc84" }, { key:"working", label:"Working", color:"#ffc02e" },
  { key:"needs_diagnosis", label:"Need Diag", color:"#ff3b46" }, { key:"on_rent", label:"On Rent", color:"#3aa0ff" },
];

function LocationsSnapshot(){
  return (
    <section>
      <Eyebrow style={{marginBottom:12}}>Locations — Snapshot</Eyebrow>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        {LOCATIONS.map(l=>{
          const sum = SEG.reduce((s,x)=>s+(l[x.key]||0),0)||1;
          return (
            <div key={l.name} className="card" style={{padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                <span className="df-data" style={{fontSize:14,fontWeight:700,color:"var(--ink)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</span>
                <span className="faint nums" style={{fontSize:11,flexShrink:0}}>{fmt(l.total)} units</span>
              </div>
              <div style={{display:"flex",height:5,marginTop:10,gap:0,borderRadius:2,overflow:"hidden",background:"#ff2b2b"}}>
                {SEG.map(s=> (l[s.key]||0)>0 ? <div key={s.key} style={{width:`${(l[s.key]/sum)*100}%`,background:s.color}} /> : null)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px",marginTop:14}}>
                {SNAP.map(s=>(
                  <div key={s.key}>
                    <div className="eyebrow" style={{fontSize:9}}>{s.label}</div>
                    <div className="df-display" style={{fontSize:22,color:s.color}}>{fmt(l[s.key]||0)}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10}}>
                <div className="eyebrow" style={{fontSize:9}}>Sold</div>
                <div className="df-display" style={{fontSize:22,color:"#ff2b2b"}}>{fmt(l.sold||0)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ExplainerCards(){
  const cards = [
    { t:"What Needs Attention Right Now", b:"Each slice = how many units are in that work stage. Red = act today. The Act-Now queue ranks them so the yard always knows what to finish first." },
    { t:"Units at Each Location", b:"Green = ready to sell. Yellow = still being worked on. Red = needs diagnosis. Blue = out on rent. Compare yards at a glance." },
    { t:"Inventory by Brand", b:"How many of each brand we have, and how many are ready to sell vs. being worked on. Yale dominates the fleet." },
    { t:"Sales This Year — by Payment Type", b:"Orange = paid in full (best). Light orange = down payment. Purple = govt contract. Tracks how revenue is committed." },
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
      {cards.map(c=>(
        <div key={c.t} className="card" style={{padding:16}}>
          <Eyebrow>{c.t}</Eyebrow>
          <p style={{margin:"10px 0 0",fontSize:12,lineHeight:1.7,color:"var(--ink-dim)"}}>{c.b}</p>
        </div>
      ))}
    </div>
  );
}

const WORK_ORDER = { needs_diagnosis:0, working:1, ready:2, on_rent:3, sold:4, unknown:5 };

function AllUnits({ units }){
  const [sortKey,setSortKey] = useStateT("work");
  const [asc,setAsc] = useStateT(true);
  const [work,setWork] = useStateT("ALL");
  const [query,setQuery] = useStateT("");

  const workBuckets = useMemoT(()=>{ const s=new Set(units.map(u=>u.work)); return Object.keys(WORK_ORDER).filter(b=>s.has(b)); },[units]);
  const filtered = useMemoT(()=>{
    const q=query.trim().toLowerCase();
    let rows = units;
    if(work!=="ALL") rows = rows.filter(u=>u.work===work);
    if(q) rows = rows.filter(u=>[u.name,u.serial,u.make,u.model,u.type,u.customer,u.soldBy].some(f=>f&&f.toLowerCase().includes(q)));
    const dir = asc?1:-1;
    const val = (u)=> sortKey==="price"?(u.price??-1):sortKey==="capacity"?(u.capacity??-1):sortKey==="work"?WORK_ORDER[u.work]:(u[sortKey]??"").toString().toLowerCase();
    return [...rows].sort((a,b)=>{ const x=val(a),y=val(b); return x<y?-1*dir:x>y?1*dir:a.id.localeCompare(b.id); });
  },[units,work,query,sortKey,asc]);

  const setSort = k => { if(k===sortKey) setAsc(!asc); else { setSortKey(k); setAsc(["name","serial","make","type","location","work"].includes(k)); } };
  const Th = ({label,k,num}) => {
    const active = sortKey===k;
    return <th onClick={()=>setSort(k)} style={{cursor:"pointer",userSelect:"none",padding:"8px 12px",textAlign:num?"right":"left",color:active?"var(--ink)":"var(--ink-dim)"}}>
      {label}<span style={{marginLeft:4,color:active?"var(--brand)":"var(--ink-faint)"}}>{active?(asc?"↑":"↓"):"↕"}</span></th>;
  };

  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search make / model / serial / customer…" style={{width:300}} />
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          <button className={cn("chip",work==="ALL"&&"active")} onClick={()=>setWork("ALL")}>All stages</button>
          {workBuckets.map(b=> <button key={b} className={cn("chip",work===b&&"active")} onClick={()=>setWork(b)}>{WORK_LABEL[b]}</button>)}
        </div>
        <span className="faint nums" style={{marginLeft:"auto",fontSize:11}}>{fmt(filtered.length)} of {fmt(units.length)} units</span>
      </div>
      <section className="card" style={{overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 16px"}}>
          <Eyebrow>All Units</Eyebrow><span className="faint" style={{fontSize:11}}>click a header to sort</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{fontSize:12,minWidth:900}}>
            <thead><tr style={{borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)"}}>
              <Th label="Unit" k="name" /><Th label="Serial" k="serial" /><Th label="Make" k="make" />
              <Th label="Location" k="location" /><Th label="Cap (lbs)" k="capacity" num /><Th label="Work Stage" k="work" />
              <Th label="Sale" k="sale" /><th style={{padding:"8px 12px",textAlign:"center",color:"var(--ink-dim)"}}>Sig</th><Th label="Price" k="price" num />
            </tr></thead>
            <tbody>
              {filtered.map(u=>(
                <tr key={u.id+":"+u.rowIndex} style={{borderBottom:"1px solid rgba(42,42,46,.5)"}}>
                  <td className="df-data" style={{padding:"9px 12px",fontWeight:700,color:"var(--ink)"}}>{u.name??"—"}</td>
                  <td className="nums" style={{padding:"9px 12px",color:"var(--pif)"}}>{u.serial}</td>
                  <td className="df-data" style={{padding:"9px 12px",color:"var(--ink-dim)"}}>{u.make}</td>
                  <td className="df-data" style={{padding:"9px 12px",color:"var(--ink-dim)"}}>{u.location}</td>
                  <td className="nums muted" style={{padding:"9px 12px",textAlign:"right"}}>{u.capacity!=null?fmt(u.capacity):"—"}</td>
                  <td style={{padding:"9px 12px"}}><WorkPill work={u.work} /></td>
                  <td style={{padding:"9px 12px"}}><SalePill sale={u.sale} /></td>
                  <td style={{padding:"9px 12px",textAlign:"center"}}>{u.committed?<span style={{color:u.signed?"var(--ready)":"var(--working)"}}>{u.signed?"✓":"○"}</span>:<span className="faint">—</span>}</td>
                  <td className="nums" style={{padding:"9px 12px",textAlign:"right",color:"var(--pif)"}}>{fmtMoney(u.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <p style={{padding:"32px 0",textAlign:"center",fontSize:12,color:"var(--ink-faint)"}}>No units match these filters.</p>}
      </section>
    </div>
  );
}

Object.assign(window, { Overview, AllUnits });
