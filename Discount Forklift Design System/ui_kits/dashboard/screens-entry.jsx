/* Entry screens: FileUpload, SchemaReview, Loading. */
const { useState: useStateE } = React;

function LoadingState({ label }){
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:"80px 0"}}>
      <div style={{display:"flex",gap:6}}>
        {[0,1,2].map(i=>(
          <span key={i} style={{width:8,height:8,borderRadius:"50%",background:"var(--brand)",
            animation:"pulse-dot 700ms ease-in-out infinite alternate",animationDelay:`${i*140}ms`}} />
        ))}
      </div>
      <Eyebrow>{label}</Eyebrow>
    </div>
  );
}

function FileUpload({ onLoad }){
  const [drag,setDrag] = useStateE(false);
  return (
    <div className="fade-up" style={{maxWidth:640,margin:"0 auto",padding:"64px 20px"}}>
      <p className="eyebrow" style={{color:"var(--brand)",margin:0}}>Inventory Intelligence</p>
      <h1 style={{margin:"8px 0 0",fontSize:24,fontWeight:700,letterSpacing:"-0.01em",color:"var(--ink)"}}>Load a fleet export to begin</h1>
      <p style={{margin:"8px 0 0",fontSize:14,color:"var(--ink-dim)",lineHeight:1.6}}>
        Drop a messy .xlsx / .xls / .csv export. We parse it in the browser, then infer the schema with
        AI — you review and veto columns before any scoring runs.
      </p>
      <div onClick={onLoad}
        onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);onLoad();}}
        style={{marginTop:24,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,
          border:`1px dashed ${drag?"var(--brand)":"var(--line)"}`,background:drag?"rgba(255,43,43,.05)":"transparent",
          padding:"56px 0",textAlign:"center",cursor:"pointer",transition:"border-color 120ms,background 120ms"}}>
        <span style={{fontSize:30,color:"var(--ink-faint)"}}>↥</span>
        <p style={{margin:0,fontSize:14,color:"var(--ink)"}}>Drag & drop, or <span style={{color:"var(--brand)"}}>browse</span></p>
        <p style={{margin:0,fontSize:11,color:"var(--ink-faint)"}}>.xlsx · .xls · .csv</p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}>
        <span style={{height:1,flex:1,background:"var(--line)"}} /><span className="eyebrow">or</span><span style={{height:1,flex:1,background:"var(--line)"}} />
      </div>
      <button className="btn" style={{width:"100%",marginTop:16,padding:"10px 0"}} onClick={onLoad}>Load messy sample data (multi-table)</button>
    </div>
  );
}

const ROLE_COLOR = { identifier:"#3aa0ff", dimension:"#3ddc84", measure:"#ff8a3d", status:"#ffc02e", flag:"#b07cff", attribution:"#3ddc84", unknown:"#5e5e66" };
const TRUST_COLOR = { high:"#3ddc84", medium:"#ffc02e", low:"#5e5e66" };

function SchemaReview({ columns, onConfirm }){
  const [cols,setCols] = useStateE(columns);
  const kept = cols.filter(c=>!c.veto).length;
  const toggle = i => setCols(cs=>cs.map((c,j)=> j===i ? {...c,veto:!c.veto} : c));
  return (
    <div className="fade-up maxw" style={{paddingTop:32,paddingBottom:48,maxWidth:880}}>
      <p className="eyebrow" style={{color:"var(--brand)",margin:0}}>Step 2 — Review</p>
      <h1 style={{margin:"8px 0 0",fontSize:22,fontWeight:700,letterSpacing:"-0.01em"}}>Audit the inferred schema</h1>
      <p style={{margin:"8px 0 16px",fontSize:13,color:"var(--ink-dim)",lineHeight:1.6,maxWidth:620}}>
        Claude labeled each column's role and trust. Veto anything that shouldn't be computed — nothing is scored until you confirm.
      </p>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 16px"}}>
          <Eyebrow>Inferred Columns</Eyebrow>
          <span className="faint nums" style={{fontSize:11}}>{kept} kept · {cols.length-kept} vetoed</span>
        </div>
        <table style={{fontSize:12,textAlign:"left"}}>
          <thead><tr style={{borderTop:"1px solid var(--line)",borderBottom:"1px solid var(--line)",color:"var(--ink-dim)"}}>
            <th style={{padding:"8px 16px"}}>Column</th><th style={{padding:"8px 16px"}}>Role</th><th style={{padding:"8px 16px"}}>Trust</th><th style={{padding:"8px 16px",textAlign:"right"}}>Include</th>
          </tr></thead>
          <tbody>
            {cols.map((c,i)=>(
              <tr key={c.name} style={{borderBottom:"1px solid rgba(42,42,46,.5)",opacity:c.veto?0.45:1}}>
                <td style={{padding:"9px 16px",fontWeight:700,color:"var(--ink)"}}>{c.name}</td>
                <td style={{padding:"9px 16px"}}><span className="pill" style={{color:ROLE_COLOR[c.role],borderColor:ROLE_COLOR[c.role]+"66"}}>{c.role}</span></td>
                <td style={{padding:"9px 16px",color:TRUST_COLOR[c.trust]}}>{c.trust}</td>
                <td style={{padding:"9px 16px",textAlign:"right"}}>
                  <button className={cn("chip",!c.veto&&"active")} onClick={()=>toggle(i)} style={{padding:"3px 10px"}}>{c.veto?"Vetoed":"✓ Keep"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:10,marginTop:18,alignItems:"center"}}>
        <button className="btn btn-primary" style={{padding:"8px 16px"}} onClick={onConfirm}>Looks good — analyze {kept} columns →</button>
        <span className="faint" style={{fontSize:11}}>You can re-upload at any time.</span>
      </div>
    </div>
  );
}

Object.assign(window, { LoadingState, FileUpload, SchemaReview });
