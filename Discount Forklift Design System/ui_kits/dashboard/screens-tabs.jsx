/* Dashboard tabs: Priority Queue, Sales Team, AI Insights. */
const { useState: useStateP, useMemo: useMemoP } = React;

/* ---------------- PRIORITY QUEUE ---------------- */
function PriorityQueue({ scoring }){
  const [tier,setTier] = useStateP("ALL");
  const [open,setOpen] = useStateP(null);
  const TIERS=["act_now","high","medium","low"];
  const rows = tier==="ALL"?scoring.ranked:scoring.ranked.filter(r=>r.tier===tier);
  const tierAccent = t => t==="act_now"?"var(--brand)":t==="high"?"var(--diag)":t==="medium"?"var(--working)":"var(--ink-dim)";

  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:20}}>
      {scoring.tierCounts.act_now>0 && (
        <div className="card" style={{borderLeft:"2px solid var(--brand)",background:"rgba(255,43,43,.05)",padding:"12px 16px"}}>
          <p style={{margin:0,display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:700,color:"var(--brand)"}}><span>⚠</span>{scoring.tierCounts.act_now} units need action now</p>
          <p style={{margin:"6px 0 0",fontSize:12,color:"var(--ink-dim)"}}>Committed-but-unfinished units lead the queue — a customer has paid or committed and the unit isn't deliverable. These go first.</p>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        <MetricCard label="In Queue" value={fmt(scoring.scoredCount)} subtext={`of ${fmt(scoring.totalUnits)} units`} big={30} />
        {TIERS.map(t=> <MetricCard key={t} label={TIER_LABEL[t]} value={fmt(scoring.tierCounts[t])} accent={tierAccent(t)} subtext="units" big={30} />)}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        <button className={cn("chip",tier==="ALL"&&"active")} onClick={()=>setTier("ALL")}>All ({fmt(scoring.scoredCount)})</button>
        {TIERS.map(t=> <button key={t} className={cn("chip",tier===t&&"active")} onClick={()=>setTier(t)}>{TIER_LABEL[t]} ({fmt(scoring.tierCounts[t])})</button>)}
      </div>
      <section className="card" style={{overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 16px"}}>
          <Eyebrow>Act-Now Queue — Ranked</Eyebrow><span className="faint" style={{fontSize:11}}>click a unit for its score breakdown</span>
        </div>
        <div>
          {rows.map((s,i)=>{
            const u=s.unit; const desc=[u.make,u.model,u.type].filter(Boolean).join(" · ");
            const title=u.name?(desc?`${u.name} · ${desc}`:u.name):desc||"Unit";
            const isOpen = open===u.rowIndex;
            const rank = scoring.ranked.indexOf(s)+1;
            return (
              <div key={u.rowIndex} onClick={()=>setOpen(isOpen?null:u.rowIndex)}
                style={{cursor:"pointer",padding:"12px 16px",borderTop:"1px solid rgba(42,42,46,.5)",background:isOpen?"var(--panel-2)":"transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span className="faint nums" style={{width:32,textAlign:"right",fontSize:12,flexShrink:0}}>#{rank}</span>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span className="faint">{isOpen?"▾":"▸"}</span>
                      <span style={{fontWeight:700,color:"var(--ink)",fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</span>
                      <TierPill tier={s.tier} />
                    </div>
                    <p style={{margin:"3px 0 0",fontSize:11,color:"var(--ink-dim)"}}>{s.action}</p>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {u.location && <span className="faint" style={{fontSize:11}}>{u.location}</span>}
                    <WorkPill work={u.work} /><SalePill sale={u.sale} />
                  </div>
                  <div style={{width:56,textAlign:"right",flexShrink:0}}>
                    <span className="nums" style={{fontSize:24,fontWeight:700,lineHeight:1,color:"var(--ink)"}}>{s.score}</span>
                    <span className="faint" style={{display:"block",fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em"}}>score</span>
                  </div>
                </div>
                {isOpen && (
                  <div onClick={e=>e.stopPropagation()} style={{marginTop:12,borderTop:"1px solid rgba(42,42,46,.5)",paddingTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <div>
                      <Eyebrow style={{marginBottom:8}}>How this score was built</Eyebrow>
                      {s.factors.map(f=>(
                        <div key={f.label} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:11,marginBottom:6}}>
                          <div><span style={{color:"var(--ink)"}}>{f.label}</span><p style={{margin:0,color:"var(--ink-faint)"}}>{f.detail}</p></div>
                          <span className="nums" style={{fontWeight:700,color:"var(--ready)",flexShrink:0}}>+{f.points}</span>
                        </div>
                      ))}
                      <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid rgba(42,42,46,.5)",paddingTop:6,fontSize:11,fontWeight:700}}>
                        <span style={{color:"var(--ink)"}}>Total</span><span className="nums" style={{color:"var(--ink)"}}>{s.score}</span>
                      </div>
                    </div>
                    <div style={{fontSize:11}}>
                      <Eyebrow style={{marginBottom:8}}>Unit</Eyebrow>
                      {[["Serial",u.serial],["Location",u.location],["Customer",u.customer],["Sold by",u.soldBy],["Sale price",u.price!=null?fmtMoney(u.price):null],["Signed",u.committed?(u.signed?"Yes":"No"):null]]
                        .filter(([,v])=>v).map(([k,v])=>(
                          <div key={k} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(42,42,46,.3)",padding:"4px 0"}}>
                            <span className="faint">{k}</span><span className="muted">{v}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------- SALES TEAM ---------------- */
function SalesTeam({ reps, roundRobin, leadSources, units }){
  const [sortKey,setSortKey] = useStateP("unitsSold");
  const [asc,setAsc] = useStateP(false);
  const [open,setOpen] = useStateP(null);
  const sold = units.filter(u=>u.work==="sold");
  const totalSold = sold.length;
  const totalSale = reps.reduce((s,r)=>s+(r.totalSale||0),0);
  const avgSale = totalSold? Math.round(totalSale/totalSold):null;
  const unsigned = sold.filter(u=>!u.signed && u.sale!=="govt_po");
  const totalEmails = reps.reduce((s,r)=>s+r.emailsSent,0);
  const activeReps = reps.filter(r=>r.unitsSold>0).length;

  const sorted = [...reps].sort((a,b)=>{ const dir=asc?1:-1; if(sortKey==="name") return a.name.localeCompare(b.name)*dir; return ((a[sortKey]||0)-(b[sortKey]||0))*dir || b.unitsSold-a.unitsSold; });
  const setSort = k => { if(k===sortKey) setAsc(!asc); else { setSortKey(k); setAsc(k==="name"); } };
  const Th = ({label,k,num}) => { const active=sortKey===k; return <th onClick={()=>setSort(k)} style={{cursor:"pointer",userSelect:"none",padding:"8px 14px",textAlign:num?"right":"left",color:active?"var(--ink)":"var(--ink-dim)"}}>{label}<span style={{marginLeft:4,color:active?"var(--brand)":"var(--ink-faint)"}}>{active?(asc?"↑":"↓"):"↕"}</span></th>; };
  const maxLead = leadSources[0]?.count||1;

  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12}}>
        <MetricCard label="Total Sold" value={fmt(totalSold)} accent="var(--diag)" subtext="Attributed units" big={30} />
        <MetricCard label="Reps Active" value={fmt(activeReps)} subtext={`${reps.length} on team`} big={30} />
        <MetricCard label="Unsigned Docs" value={fmt(unsigned.length)} accent="var(--working)" subtext="Real open deals" big={30} />
        <MetricCard label="Avg Sale" value={fmtMoney(avgSale)} accent="var(--ready)" subtext="Per unit" big={30} />
        <MetricCard label="Total Sales $" value={fmtMoney(totalSale||null)} accent="var(--pif)" subtext="Attributed" big={30} />
        <MetricCard label="Emails Sent" value={fmt(totalEmails)} accent="var(--rent)" subtext="Outreach (proxy)" big={30} />
      </div>

      <section className="card" style={{overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 16px"}}>
          <Eyebrow>Sales Team — Leaderboard</Eyebrow><span className="faint" style={{fontSize:11}}>click a rep for what they sold · click a header to sort</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{fontSize:12,minWidth:760}}>
            <thead><tr style={{borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)"}}>
              <Th label="Rep" k="name" /><th style={{padding:"8px 14px",color:"var(--ink-dim)"}}>Location</th>
              <Th label="Units" k="unitsSold" num /><Th label="Total $" k="totalSale" num /><Th label="Avg $" k="avgSale" num />
              <Th label="Emails" k="emailsSent" num /><Th label="Unsigned" k="unsignedDocs" num />
            </tr></thead>
            <tbody>
              {sorted.map(r=>{
                const isOpen=open===r.name; const repUnits = sold.filter(u=>u.soldBy===r.name);
                return (
                  <React.Fragment key={r.name}>
                    <tr onClick={()=>setOpen(isOpen?null:r.name)} style={{cursor:"pointer",borderBottom:"1px solid rgba(42,42,46,.5)",background:isOpen?"var(--panel-2)":"transparent"}}>
                      <td style={{padding:"9px 14px",fontWeight:700,color:"var(--ink)"}}><span className="faint" style={{marginRight:6}}>{isOpen?"▾":"▸"}</span>{r.name}</td>
                      <td className="muted" style={{padding:"9px 14px"}}>{r.location??"—"}</td>
                      <td className="nums" style={{padding:"9px 14px",textAlign:"right",fontWeight:700,color:"var(--ink)"}}>{r.unitsSold||"—"}</td>
                      <td className="nums" style={{padding:"9px 14px",textAlign:"right",color:"var(--pif)"}}>{fmtMoney(r.totalSale||null)}</td>
                      <td className="nums muted" style={{padding:"9px 14px",textAlign:"right"}}>{fmtMoney(r.avgSale)}</td>
                      <td className="nums" style={{padding:"9px 14px",textAlign:"right",color:"var(--rent)"}}>{fmt(r.emailsSent)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right"}}>{r.unsignedDocs>0?<span className="nums" style={{background:"rgba(255,192,46,.15)",padding:"2px 8px",fontWeight:700,color:"var(--working)"}}>{r.unsignedDocs}</span>:<span className="faint">0</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{borderBottom:"1px solid rgba(42,42,46,.5)"}}><td colSpan={7} style={{background:"rgba(10,10,11,.4)",padding:"12px 16px"}}>
                        {repUnits.length===0 ? <p className="faint" style={{margin:0,fontSize:11}}>No attributed units{r.title?` · ${r.title}`:""}.</p> : (
                          <div>
                            <Eyebrow style={{marginBottom:8}}>What {r.name} sold ({repUnits.length})</Eyebrow>
                            {repUnits.map((u,i)=>(
                              <div key={i} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:11,padding:"3px 0"}}>
                                <span style={{color:"var(--ink)"}}>{[u.make,u.model,u.type].filter(Boolean).join(" · ")}</span>
                                <span style={{display:"flex",alignItems:"center",gap:12}}>
                                  <span className="muted">{u.customer}</span><SalePill sale={u.sale} />
                                  <span style={{width:10,textAlign:"center",color:u.signed?"var(--ready)":"var(--working)"}}>{u.signed?"✓":"○"}</span>
                                  <span className="nums" style={{width:64,textAlign:"right",color:"var(--pif)"}}>{fmtMoney(u.price)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Panel title="Round-Robin — Next Up" hint="as of today">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {roundRobin.map(q=>(
              <div key={q.queue} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid rgba(42,42,46,.4)",paddingBottom:6,fontSize:12}}>
                <span className="muted">{q.queue}</span><span style={{fontWeight:700,color:"var(--ink)"}}>{q.assignee}</span>
              </div>
            ))}
            <p className="faint" style={{margin:"4px 0 0",fontSize:10}}>Live pointer per queue — not a lead-distribution history.</p>
          </div>
        </Panel>
        <Panel title="Lead Sources">
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {leadSources.map(l=>(
              <div key={l.source}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span className="muted">{l.source}</span><span className="nums" style={{color:"var(--ink)"}}>{fmt(l.count)}</span></div>
                <div style={{height:4,background:"var(--panel-2)",borderRadius:2,overflow:"hidden",marginTop:4}}><div style={{height:"100%",width:`${l.count/maxLead*100}%`,background:"var(--rent)"}} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <section className="card" style={{padding:16,borderColor:"rgba(255,192,46,.3)"}}>
        <Eyebrow style={{color:"var(--working)"}}>Unsigned PandaDocs — Chase These ({unsigned.length})</Eyebrow>
        <p className="faint" style={{margin:"6px 0 12px",fontSize:11}}>Committed deals (down-payment / paid-in-full) with no signature on file. Govt POs and removed units excluded.</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {unsigned.slice(0,8).map((u,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",gap:12,borderBottom:"1px solid rgba(42,42,46,.4)",paddingBottom:6,fontSize:11}}>
              <span style={{color:"var(--ink)"}}>{[u.make,u.model,u.type].filter(Boolean).join(" · ")}</span>
              <span style={{display:"flex",alignItems:"center",gap:12}}><span className="muted">{u.soldBy}</span><SalePill sale={u.sale} /><span className="nums" style={{width:64,textAlign:"right",color:"var(--pif)"}}>{fmtMoney(u.price)}</span></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------------- AI INSIGHTS ---------------- */
const RULES = [
  { label:"Committed, unsigned", points:55, when:"Sold + committed with no signature on file" },
  { label:"Open work on sold", points:40, when:"Committed unit still in service / needs diagnosis" },
  { label:"Needs diagnosis", points:25, when:"Work stage = needs diagnosis" },
  { label:"Down payment open", points:18, when:"Down-payment deal, unsigned" },
  { label:"In service", points:12, when:"Work stage = being worked on" },
];
function InsightsTab({ scoring, units }){
  const TIERS=["act_now","high","medium","low"];
  const TIER_FILL={act_now:"#ff2b2b",high:"#ff3b46",medium:"#ffc02e",low:"#5e5e66"};
  const total = scoring.scoredCount||1;
  const insights=[
    {sev:"act",dot:"var(--brand)",title:`${scoring.tierCounts.act_now} units are blocking revenue`,body:"Committed-but-unfinished units sit at the top of the queue — a customer has already paid or committed. Clearing these is the fastest revenue unlock."},
    {sev:"watch",dot:"var(--working)",title:"Unsigned paperwork is the recurring drag",body:"Several closed deals lack a signature on file. Chase the PandaDoc worklist before opening new outreach."},
    {sev:"info",dot:"var(--rent)",title:"Dallas carries the most ready inventory",body:"Ready-to-sell stock is concentrated in one yard — rebalance demand or shift marketing spend accordingly."},
  ];
  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:20}}>
      <section className="card" style={{padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <Eyebrow>AI Insights</Eyebrow>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span className="pill" style={{color:"var(--ready)",borderColor:"rgba(61,220,132,.4)"}}>AI</span>
            <button className="btn">Regenerate</button>
          </div>
        </div>
        <p style={{margin:"14px 0 0",fontSize:14,color:"var(--ink)",lineHeight:1.6}}>The fleet is healthy on volume but leaking on follow-through: a cluster of committed units can't ship and several closed deals are unsigned. Work the Act-Now queue top-down before chasing new leads.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
          {insights.map((ins,i)=>(
            <div key={i} style={{border:"1px solid var(--line)",background:"var(--panel-2)",padding:12}}>
              <p style={{margin:0,display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:"var(--ink)"}}><span style={{width:8,height:8,borderRadius:"50%",background:ins.dot,display:"inline-block"}} />{ins.title}</p>
              <p style={{margin:"6px 0 0",fontSize:11,color:"var(--ink-dim)",lineHeight:1.6}}>{ins.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{padding:16}}>
        <Eyebrow>How Scores Were Calculated</Eyebrow>
        <p className="faint" style={{margin:"4px 0 0",fontSize:11}}>Priority is computed deterministically — no AI ranks any unit. Same export, same order, every time.</p>
        <div style={{marginTop:14,overflowX:"auto"}}>
          <table style={{fontSize:12,minWidth:520,textAlign:"left"}}>
            <thead><tr style={{borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)",color:"var(--ink-dim)"}}>
              <th style={{padding:"8px 12px"}}>Rule</th><th style={{padding:"8px 12px",textAlign:"right",width:64}}>Points</th><th style={{padding:"8px 12px"}}>When it fires</th>
            </tr></thead>
            <tbody>
              {RULES.map(r=>(
                <tr key={r.label} style={{borderBottom:"1px solid rgba(42,42,46,.5)",verticalAlign:"top"}}>
                  <td style={{padding:"8px 12px",fontWeight:700,color:"var(--ink)"}}>{r.label}</td>
                  <td className="nums" style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"var(--ready)"}}>+{r.points}</td>
                  <td className="faint" style={{padding:"8px 12px"}}>{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:16}}>
          <Eyebrow style={{marginBottom:8}}>Queue by tier</Eyebrow>
          <div style={{display:"flex",height:8,borderRadius:2,overflow:"hidden",background:"var(--panel-2)"}}>
            {TIERS.map(t=>{ const v=scoring.tierCounts[t]; return v?<div key={t} style={{width:`${v/total*100}%`,background:TIER_FILL[t]}} title={`${TIER_LABEL[t]}: ${v}`} />:null; })}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:10,fontSize:11,alignItems:"center"}}>
            {TIERS.map(t=> <span key={t} style={{display:"flex",alignItems:"center",gap:6}}><TierPill tier={t} /><span className="nums muted">{fmt(scoring.tierCounts[t])}</span></span>)}
            <span className="faint" style={{marginLeft:"auto"}}>{fmt(scoring.scoredCount)} of {fmt(scoring.totalUnits)} units queued</span>
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { PriorityQueue, SalesTeam, InsightsTab });
