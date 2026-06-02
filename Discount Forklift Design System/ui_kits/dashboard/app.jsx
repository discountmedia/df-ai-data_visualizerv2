/* Main app — state machine (idle → parsing → review → ready) + tab routing. */
const { useState: useStateA, useMemo: useMemoA, useEffect: useEffectA } = React;

function App(){
  const [phase,setPhase] = useStateA("idle");   // idle | parsing | review | ready
  const [analyzed,setAnalyzed] = useStateA(false);
  const [tab,setTab] = useStateA("overview");
  const [loc,setLoc] = useStateA("ALL");
  const [theme,setTheme] = useStateA("dark");

  useEffectA(()=>{ document.documentElement.dataset.theme = theme; },[theme]);

  const units = useMemoA(()=> loc==="ALL"?UNITS:UNITS.filter(u=>u.location===titleCase(loc)),[loc]);
  const scoring = useMemoA(()=>scoreUnits(units),[units]);

  const load = ()=>{ setPhase("parsing"); setTimeout(()=>setPhase("review"),900); };
  const confirm = ()=>{ setPhase("parsing"); setTimeout(()=>{ setPhase("ready"); setAnalyzed(true); setTab("overview"); },800); };
  const reset = ()=>{ setPhase("idle"); setAnalyzed(false); setLoc("ALL"); setTab("overview"); };

  if(phase==="idle") return <FileUpload onLoad={load} />;
  if(phase==="parsing") return <LoadingState label="Inferring schema with AI…" />;
  if(phase==="review") return <SchemaReview columns={SCHEMA_COLUMNS} onConfirm={confirm} />;

  const tabs = [
    {id:"overview",label:"Overview"},
    {id:"actnow",label:"Act Now",count:503,dot:true},
    {id:"units",label:"All Units",count:FLEET.total},
    {id:"locations",label:"Locations",count:LOCATIONS.length},
    {id:"sales",label:"Sales Team",count:40},
    {id:"leads",label:"Leads",count:LEADS.total},
    {id:"media",label:"Media"},
    {id:"sold",label:"Sold",count:FLEET.sold},
    {id:"onrent",label:"On Rent",count:FLEET.onRent},
    {id:"insights",label:"AI Insights",count:8},
  ];

  return (
    <div style={{minHeight:"100vh"}}>
      <Header fileName="full3.xlsx" analyzed={analyzed}
        tabs={tabs} activeTab={tab} onTab={setTab} onReset={reset}
        onAnalyze={()=>setTab("insights")} theme={theme} onToggleTheme={()=>setTheme(theme==="dark"?"light":"dark")} />
      <LocationBar locations={LOCATIONS} value={loc} onChange={setLoc} />
      <main className="maxw" style={{padding:"22px 28px 64px"}}>
        {tab==="overview" && <Overview loc={loc} onView={()=>setTab("actnow")} />}
        {tab==="actnow" && <PriorityQueue scoring={scoring} />}
        {tab==="units" && <AllUnits units={units} />}
        {tab==="locations" && <LocationsTab />}
        {tab==="sales" && <SalesTeam reps={REPS} roundRobin={ROUND_ROBIN} leadSources={LEAD_SOURCES} units={units} />}
        {tab==="leads" && <LeadsTab />}
        {tab==="media" && <MediaTab />}
        {tab==="sold" && <SoldTab />}
        {tab==="onrent" && <OnRentTab units={UNITS} />}
        {tab==="insights" && <InsightsTab scoring={scoring} units={units} />}
      </main>
    </div>
  );
}

function titleCase(s){ return ({"DFW":"DFW","PHOENIX":"Phoenix","LAS VEGAS":"Vegas","DENVER":"Denver"})[s] || s; }

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
