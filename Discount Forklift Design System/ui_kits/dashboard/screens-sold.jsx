/* SOLD tab (rich table) + Leads + Locations + Media + On Rent. */
const { useState: useStateS, useMemo: useMemoS } = React;

/* ---------------- SOLD ---------------- */
function SoldTab(){
  const [query,setQuery] = useStateS("");
  const [sortKey,setSortKey] = useStateS("ws");
  const [asc,setAsc] = useStateS(true);

  const rows = useMemoS(()=>{
    const q=query.trim().toLowerCase();
    let r = SOLD_ROWS;
    if(q) r = r.filter(u=>[u.name,u.serial,u.make,u.soldTo,u.rep,u.location].some(f=>f&&f.toLowerCase().includes(q)));
    const dir = asc?1:-1;
    const val = u => sortKey==="ws"?u.workStatus.code : sortKey==="cap"?u.capacity : (u[sortKey]??"").toString().toLowerCase();
    return [...r].sort((a,b)=>{ const x=val(a),y=val(b); return x<y?-1*dir:x>y?1*dir:0; });
  },[query,sortKey,asc]);

  const setSort = k => { if(k===sortKey) setAsc(!asc); else { setSortKey(k); setAsc(true); } };
  const Th = ({label,k,num}) => {
    const active=sortKey===k;
    return <th onClick={k?()=>setSort(k):undefined} style={{cursor:k?"pointer":"default",userSelect:"none",padding:"10px 12px",textAlign:num?"right":"left",color:active?"var(--ink)":"var(--ink-dim)",whiteSpace:"nowrap"}}>
      {label}{k && <span style={{marginLeft:4,color:active?"var(--brand)":"var(--ink-faint)"}}>{active?(asc?"↑":"↓"):"⌄"}</span>}</th>;
  };

  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
        <MetricCard label="Total Sold" value={fmt(FLEET.sold)} accent="var(--brand)" subtext="All attributed" />
        <MetricCard label="Paid in Full" value={fmt(FLEET.paidInFull)} accent="var(--brand)" subtext="Best" />
        <MetricCard label="Down Payment" value={fmt(FLEET.downPayment)} accent="var(--pif)" subtext="Awaiting balance" />
        <MetricCard label="Govt PO" value={fmt(FLEET.govtPo)} accent="var(--govt)" subtext="Contract" />
        <MetricCard label="Open Work on Sold" value={fmt(FLEET.openWorkOnSold)} accent="var(--diag)" subtext="Needs completion" />
      </div>

      <div className="card" style={{borderLeft:"3px solid var(--brand)",background:"linear-gradient(90deg, rgba(255,43,43,.12), rgba(255,43,43,.01))",padding:"14px 18px",display:"flex",gap:14,alignItems:"flex-start"}}>
        <span style={{fontSize:16,color:"var(--brand)"}}>⚠</span>
        <div>
          <p style={{margin:0,fontSize:12,fontWeight:700,color:"var(--brand)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{FLEET.openWorkOnSold} sold units still need work — these are your top priority</p>
          <p style={{margin:"5px 0 0",fontSize:13,color:"var(--ink-dim)"}}>Customer has paid but unit isn't done yet. Complete these first.</p>
        </div>
      </div>

      <section className="card" style={{overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",gap:12,flexWrap:"wrap"}}>
          <span className="faint" style={{fontSize:12}}>{fmt(FLEET.sold)} rows — click any column header to sort</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search…" style={{width:220}} />
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{fontSize:13,minWidth:1240}}>
            <thead><tr style={{borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em"}}>
              <Th label="Name" k="name" /><Th label="Serial 4" k="serial" /><Th label="Make" k="make" /><Th label="Type" k="type" />
              <Th label="Cap (lbs)" k="cap" num /><Th label="Location" k="location" /><Th label="Sale Type" k="sale" />
              <Th label="Sold To" k="soldTo" /><Th label="Rep" k="rep" />
              <th style={{padding:"10px 12px",textAlign:"center",color:"var(--ink-dim)"}}>Invoiced</th>
              <th style={{padding:"10px 12px",color:"var(--ink-dim)"}}>PandaDoc</th>
              <Th label="Work Status" k="ws" />
            </tr></thead>
            <tbody>
              {rows.map(u=>(
                <tr key={u.id} style={{borderBottom:"1px solid rgba(42,42,46,.5)"}}>
                  <td className="df-data" style={{padding:"10px 12px",fontWeight:700,color:"var(--ink)"}}>{u.name}</td>
                  <td className="nums" style={{padding:"10px 12px",color:"var(--pif)"}}>{u.serial}</td>
                  <td className="df-data" style={{padding:"10px 12px",color:"var(--ink)"}}>{u.make}</td>
                  <td className="df-data" style={{padding:"10px 12px",color:"var(--ink-dim)",maxWidth:200}}>{u.type}</td>
                  <td className="nums" style={{padding:"10px 12px",textAlign:"right",color:"var(--ink)"}}>{fmt(u.capacity)}</td>
                  <td className="df-data" style={{padding:"10px 12px",color:"var(--ink)"}}>{u.location}</td>
                  <td style={{padding:"10px 12px"}}><SaleTypeCell sale={u.sale} /></td>
                  <td className="df-data" style={{padding:"10px 12px",color:"var(--ink)"}}>{u.soldTo}</td>
                  <td className="df-data" style={{padding:"10px 12px",color:"var(--ink-dim)"}}>{u.rep}</td>
                  <td style={{padding:"10px 12px",textAlign:"center"}}>{u.invoiced?<span style={{color:"var(--ready)"}}>✓</span>:<span className="faint">—</span>}</td>
                  <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>{u.pandadoc==="signed"?<span style={{color:"var(--ready)"}}>✓ Signed</span>:<span style={{color:"var(--diag)"}}>✕ Pending</span>}</td>
                  <td style={{padding:"10px 12px"}}><WorkStatusPill ws={u.workStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------------- LEADS ---------------- */
function LeadsTab(){
  const max = LEAD_SOURCES[0].count;
  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
        <MetricCard label="Total Leads" value={fmt(LEADS.total)} subtext="All sources" />
        <MetricCard label="DFB Leads" value={fmt(LEADS.dfb)} accent="var(--brand)" subtext={`${LEADS.dfbConverted} converted`} />
        <MetricCard label="Octane Leads" value={fmt(LEADS.octane)} accent="var(--pif)" subtext={`${LEADS.octaneConverted} converted`} />
        <MetricCard label="Converted" value={fmt(LEADS.converted)} accent="var(--ready)" subtext="Won deals" />
        <MetricCard label="Close Rate" value={LEADS.closeRate+"%"} accent="var(--rent)" subtext="Lead → sale" />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Panel title="Lead Sources" hint="volume by channel">
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {LEAD_SOURCES.map(l=>(
              <div key={l.source}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span className="df-data muted">{l.source}</span><span className="nums" style={{color:"var(--ink)"}}>{fmt(l.count)}</span></div>
                <div style={{height:5,background:"var(--panel-2)",borderRadius:2,overflow:"hidden",marginTop:5}}><div style={{height:"100%",width:`${l.count/max*100}%`,background:"var(--rent)"}} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Conversion — by Sub-Brand" hint="leads → sales">
          <BarsH data={[
            {name:"DFB",value:LEADS.dfbConverted,color:"#ff2b2b"},
            {name:"Octane",value:LEADS.octaneConverted,color:"#ff8a3d"},
            {name:"Open",value:LEADS.total-LEADS.converted,color:"#5e5e66"},
          ]} />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- LOCATIONS ---------------- */
function LocationsTab(){
  const ranked = [...LOCATIONS].sort((a,b)=>b.total-a.total);
  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Panel title="Units by Yard" hint="total inventory">
          <BarsH data={ranked.filter(l=>l.total>3).map(l=>({name:l.name,value:l.total,color:"#3aa0ff"}))} />
        </Panel>
        <Panel title="Sellable vs In-Work" hint="ready + on rent vs working + diag">
          <BarsH data={ranked.filter(l=>l.total>3).map(l=>({name:l.name,value:l.ready+l.on_rent,color:"#3ddc84"}))} />
        </Panel>
      </div>
      <section>
        <Eyebrow style={{marginBottom:12}}>Per-Yard Snapshot</Eyebrow>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
          {ranked.map(l=>{
            const sum=["ready","working","needs_diagnosis","on_rent","sold"].reduce((s,k)=>s+(l[k]||0),0)||1;
            return (
              <div key={l.name} className="card" style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                  <span className="df-data" style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</span>
                  <span className="faint nums" style={{fontSize:11}}>{fmt(l.total)}</span>
                </div>
                <div style={{display:"flex",height:6,marginTop:10,borderRadius:2,overflow:"hidden",background:"#ff2b2b"}}>
                  {[["ready","#3ddc84"],["working","#ffc02e"],["needs_diagnosis","#ff3b46"],["on_rent","#3aa0ff"]].map(([k,c])=> (l[k]||0)>0?<div key={k} style={{width:`${l[k]/sum*100}%`,background:c}} />:null)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------- MEDIA (AI image QA) ---------------- */
const MEDIA_ITEMS = [
  { file:"forklift_Hyster_2020_J30XNT_C-3K_E-1.jpg", verdict:"Needs Review", conf:71,
    gemini:{v:"Fail",c:95,t:"Background text is mangled and fused with the forklift frame — a common AI generation error."},
    gpt:{v:"Pass",c:95,t:"The forklift appears natural with no significant visual artifacts."},
    checks:[["Forklift Forks","ok"],["Forklift Mast","ok"],["Operator Seat","ok"],["Wheel Count","ok"],["Duplicate Objects","ok"],["Text / Labels","fail"],["Lighting & Shadows","ok"],["Background","warn"],["Proportions","ok"]] },
  { file:"forklift_Hyster_2020_J30XNT_C-3K_E-6.jpg", verdict:"Needs Review", conf:71,
    gemini:{v:"Fail",c:95,t:"Mast contains floating elements; mirrored plants on either side indicate synthetic generation."},
    gpt:{v:"Pass",c:95,t:"Components are correctly represented; structure appears sound."},
    checks:[["Forklift Forks","ok"],["Forklift Mast","fail"],["Operator Seat","warn"],["Wheel Count","ok"],["Duplicate Objects","warn"],["Text / Labels","fail"],["Lighting & Shadows","ok"],["Background","warn"],["Proportions","ok"]] },
];
const CHK = { ok:{c:"#3ddc84",l:"OK"}, warn:{c:"#ffc02e",l:"Warn"}, fail:{c:"#ff3b46",l:"Fail"} };

function MediaTab(){
  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div className="card" style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Eyebrow>Media — AI Image QA · {MEDIA_ITEMS.length} of 11</Eyebrow>
        <span className="faint" style={{fontSize:11}}>Gemini vs GPT-4o · slop detector</span>
      </div>
      {MEDIA_ITEMS.map((m,i)=>(
        <section key={i} className="card" style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
              <div style={{width:44,height:32,background:"#2a2a2e",borderRadius:3,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🚜</div>
              <span className="df-data" style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.file}</span>
            </div>
            <span className="ws ws-open" style={{flexShrink:0}}>⚠ {m.verdict}</span>
          </div>
          <div style={{display:"inline-flex",marginBottom:14}}><span className="ws ws-done">◑ AIs disagree — review carefully</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {[["Gemini",m.gemini,"#3aa0ff"],["GPT-4o",m.gpt,"#3ddc84"]].map(([name,d,dot])=>(
              <div key={name} style={{border:"1px solid var(--line)",background:"var(--panel-2)",padding:14,borderRadius:4}}>
                <p style={{margin:0,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--ink-dim)",display:"flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:dot}} />{name}</p>
                <p style={{margin:"8px 0 0",fontSize:18,fontWeight:700,color:d.v==="Pass"?"var(--ready)":"var(--diag)"}}>{d.v}</p>
                <p className="faint" style={{margin:"2px 0 0",fontSize:11}}>{d.c}% confidence</p>
                <p style={{margin:"8px 0 0",fontSize:12,color:"var(--ink-dim)",lineHeight:1.6}}>{d.t}</p>
              </div>
            ))}
          </div>
          <Eyebrow style={{marginBottom:10}}>Artifact Checklist</Eyebrow>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px"}}>
            {m.checks.map(([label,st])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(42,42,46,.4)",paddingBottom:7}}>
                <span style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--ink)"}}><span style={{width:7,height:7,borderRadius:"50%",background:CHK[st].c}} />{label}</span>
                <span style={{fontSize:12,color:CHK[st].c}}>{CHK[st].l}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- ON RENT ---------------- */
function OnRentTab({ units }){
  const rentals = units.filter(u=>u.work==="on_rent");
  const rev = rentals.reduce((s,u)=>s+(u.price||0),0);
  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <MetricCard label="On Rent" value={fmt(FLEET.onRent)} accent="var(--rent)" subtext="Units generating income" />
        <MetricCard label="Monthly Rev" value={fmtMoney(rev)} accent="var(--ready)" subtext="Across rented units" />
        <MetricCard label="Avg / Unit" value={fmtMoney(rentals.length?Math.round(rev/rentals.length):null)} accent="var(--pif)" subtext="Monthly" />
        <MetricCard label="Yards" value={fmt(new Set(rentals.map(u=>u.location)).size)} subtext="With rentals" />
      </div>
      <section className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"12px 16px"}}><Eyebrow>On Rent — Fleet</Eyebrow></div>
        <div style={{overflowX:"auto"}}>
          <table style={{fontSize:13,minWidth:680}}>
            <thead><tr style={{borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.04em",color:"var(--ink-dim)"}}>
              <th style={{padding:"9px 12px",textAlign:"left"}}>Unit</th><th style={{padding:"9px 12px",textAlign:"left"}}>Make</th>
              <th style={{padding:"9px 12px",textAlign:"left"}}>Location</th><th style={{padding:"9px 12px",textAlign:"right"}}>Cap</th><th style={{padding:"9px 12px",textAlign:"right"}}>Monthly</th>
            </tr></thead>
            <tbody>
              {rentals.slice(0,16).map(u=>(
                <tr key={u.id} style={{borderBottom:"1px solid rgba(42,42,46,.5)"}}>
                  <td className="df-data" style={{padding:"9px 12px",fontWeight:700}}>{u.name??u.serial}</td>
                  <td className="df-data muted" style={{padding:"9px 12px"}}>{u.make}</td>
                  <td className="df-data muted" style={{padding:"9px 12px"}}>{u.location}</td>
                  <td className="nums muted" style={{padding:"9px 12px",textAlign:"right"}}>{fmt(u.capacity)}</td>
                  <td className="nums" style={{padding:"9px 12px",textAlign:"right",color:"var(--rent)"}}>{fmtMoney(u.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { SoldTab, LeadsTab, LocationsTab, MediaTab, OnRentTab });
