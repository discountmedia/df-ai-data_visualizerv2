/* Header (sticky, top-rule, logo, 10-tab nav) + location filter bar. */

function Header({ fileName, analyzed, tabs, activeTab, onTab, onReset, onAnalyze, theme, onToggleTheme }){
  return (
    <header style={{position:"sticky",top:0,zIndex:20,borderBottom:"1px solid var(--line)",background:"color-mix(in srgb, var(--ground) 92%, transparent)",backdropFilter:"blur(8px)"}}>
      <div className="maxw">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:16,minWidth:0}}>
            <img src="logo.png" alt="Discount Forklift" style={{height:22,flexShrink:0}} />
            <span className="eyebrow" style={{flexShrink:0}}>Inventory Dashboard</span>
            <span className="faint" style={{fontSize:11,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>— {fileName}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <button className="btn" onClick={onToggleTheme}>{theme==="dark"?"☀ Light":"☾ Dark"}</button>
            <button className="btn btn-primary" onClick={onAnalyze}>{analyzed?"⟳ Re-Analyze":"⚡ AI Analysis"}</button>
            <button className="btn" onClick={onReset}>⤓ New file</button>
          </div>
        </div>
      </div>
      <div className="top-rule" />
      <div className="maxw">
        <nav style={{display:"flex",gap:2,overflowX:"auto",padding:"4px 0"}}>
          {tabs.map(t=>{
            const active = activeTab===t.id;
            return (
              <button key={t.id} onClick={()=>onTab(t.id)}
                style={{display:"flex",alignItems:"center",gap:7,border:"none",background:"none",cursor:"pointer",
                  borderBottom:`2px solid ${active?"var(--brand)":"transparent"}`,padding:"9px 12px",fontSize:12,
                  textTransform:"uppercase",letterSpacing:"0.05em",color:active?"var(--brand)":"var(--ink-dim)",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {t.dot && <span style={{width:7,height:7,borderRadius:"50%",background:"var(--brand)",animation:"pulse-dot 900ms ease-in-out infinite alternate"}} />}
                {t.label}
                {t.count!=null && <span className="count-chip" style={active?{color:"var(--brand)",borderColor:"rgba(255,43,43,.4)"}:null}>{t.count.toLocaleString()}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function LocationBar({ locations, value, onChange }){
  const byName = Object.fromEntries(locations.map(l=>[l.name.toUpperCase(),l]));
  const total = locations.reduce((s,l)=>s+l.total,0);
  const tabs = [{name:"ALL",total}, ...FILTER_LOCS.map(n=>({name:n, total:(byName[n]||{}).total ?? 0}))];
  return (
    <div style={{borderBottom:"1px solid var(--line)",background:"color-mix(in srgb, var(--ground) 70%, transparent)"}}>
      <div className="maxw" style={{display:"flex",alignItems:"center",gap:6,overflowX:"auto",padding:"8px 28px"}}>
        <span className="eyebrow" style={{marginRight:8,flexShrink:0}}>Location:</span>
        {tabs.map(l=>{
          const active = value===l.name;
          return (
            <button key={l.name} onClick={()=>onChange(l.name)}
              style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,border:`1px solid ${active?"var(--brand)":"transparent"}`,
                background:active?"rgba(255,43,43,.06)":"none",cursor:"pointer",padding:"5px 12px",borderRadius:4,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",
                color:active?"var(--brand)":"var(--ink-dim)",fontFamily:"inherit"}}>
              {l.name}{l.total>0 && <span className="faint nums">{l.total.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Header, LocationBar });
