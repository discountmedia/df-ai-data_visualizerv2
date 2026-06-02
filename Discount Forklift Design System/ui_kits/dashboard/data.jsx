/* Sample data for the Discount Forklift dashboard UI kit (current build).
   Headline KPIs are canonical constants matching the live product screenshots;
   table rows are a curated representative sample. This is a cosmetic kit. */

/* ---- label / color maps ---- */
const WORK_LABEL = { ready:"Ready", working:"Being Worked", needs_diagnosis:"Needs Diag", on_rent:"On Rent", sold:"Sold", unknown:"Unknown" };
const WORK_HEX = { ready:"#3ddc84", working:"#ffc02e", needs_diagnosis:"#ff3b46", on_rent:"#3aa0ff", sold:"#ff2b2b", unknown:"#2a2a2e" };
const WORK_PILL = {
  ready:{c:"#3ddc84",b:"rgba(61,220,132,.4)"}, working:{c:"#ffc02e",b:"rgba(255,192,46,.4)"},
  needs_diagnosis:{c:"#ff3b46",b:"rgba(255,59,70,.4)"}, on_rent:{c:"#3aa0ff",b:"rgba(58,160,255,.4)"},
  sold:{c:"#ff8a8a",b:"rgba(255,43,43,.4)"}, unknown:{c:"#5e5e66",b:"#2a2a2e"},
};
const SALE_LABEL = { paid_in_full:"Paid in Full", down_payment:"Down Payment", govt_po:"Govt PO", rental:"Rental", other:"Other", unknown:"—" };
const SALE_PILL = {
  paid_in_full:{c:"#ff8a3d",b:"rgba(255,138,61,.55)"}, down_payment:{c:"#ff8a3d",b:"rgba(255,138,61,.55)"},
  govt_po:{c:"#b07cff",b:"rgba(176,124,255,.5)"}, rental:{c:"#3aa0ff",b:"rgba(58,160,255,.4)"},
  other:{c:"#9a9aa0",b:"#2a2a2e"}, unknown:{c:"#5e5e66",b:"#2a2a2e"},
};
const TIER_LABEL = { act_now:"Act Now", high:"High", medium:"Medium", low:"Low" };
const TIER_PILL = {
  act_now:{c:"#ff2b2b",b:"rgba(255,43,43,.5)",bg:"rgba(255,43,43,.1)"},
  high:{c:"#ff3b46",b:"rgba(255,59,70,.4)",bg:"rgba(255,59,70,.05)"},
  medium:{c:"#ffc02e",b:"rgba(255,192,46,.4)",bg:"rgba(255,192,46,.05)"},
  low:{c:"#9a9aa0",b:"#2a2a2e",bg:"transparent"},
};

/* ---- canonical headline KPIs (match the live screenshots) ---- */
const FLEET = {
  total:1256, ready:117, working:290, needsDiagnosis:409, onRent:105, sold:175,
  paidInFull:80, downPayment:79, govtPo:16, openWorkOnSold:105,
};
const LEADS = {
  total:698, dfb:639, dfbConverted:143, octane:2, octaneConverted:0,
  converted:180, closeRate:25.8,
};

/* ---- locations (per-yard snapshot) ---- */
const LOCATIONS = [
  { name:"Denver", total:318, ready:30, working:82, needs_diagnosis:88, on_rent:28, sold:54 },
  { name:"DFW", total:280, ready:15, working:119, needs_diagnosis:70, on_rent:20, sold:46 },
  { name:"Vegas", total:253, ready:25, working:43, needs_diagnosis:110, on_rent:27, sold:28 },
  { name:"Phoenix", total:220, ready:47, working:46, needs_diagnosis:62, on_rent:30, sold:29 },
  { name:"Factory", total:172, ready:0, working:0, needs_diagnosis:76, on_rent:0, sold:8 },
  { name:"Pomona, California", total:2, ready:0, working:0, needs_diagnosis:0, on_rent:0, sold:2 },
  { name:", Texas", total:1, ready:0, working:0, needs_diagnosis:0, on_rent:0, sold:1 },
  { name:"Miami, Florida", total:1, ready:0, working:0, needs_diagnosis:0, on_rent:0, sold:1 },
  { name:"Cary, Illinois", total:1, ready:0, working:0, needs_diagnosis:0, on_rent:0, sold:1 },
  { name:"Madison Heights, Michigan", total:1, ready:0, working:0, needs_diagnosis:0, on_rent:0, sold:1 },
  { name:", Virginia", total:1, ready:0, working:0, needs_diagnosis:1, on_rent:0, sold:0 },
  { name:"Camarillo, California", total:1, ready:0, working:0, needs_diagnosis:1, on_rent:0, sold:0 },
];
/* top yards for the location filter bar */
const FILTER_LOCS = ["DFW","PHOENIX","LAS VEGAS","DENVER"];

/* ---- forklift given names + helpers ---- */
const NAMES = ["Ruth","Tillie","Madelynn","Melanie","Hayley","Lilah","Judy","Sheree","Jaelyn","Kaia","Celine","Dayana","Tianna","Roxana","Sand","Bella","Ramona","Esme","Juno","Wren","Opal","Mabel","Greta","Lottie","Cleo","Nadia","Faye","Dottie","Pearl","Ivy","Maren","Sloane","Della","Etta","Vera","Nina","Birdie","Goldie","Hazel","Coraline"];
const MAKES_WEIGHTED = ["Yale","Yale","Yale","Yale","Hyster","Crown","Toyota","Raymond","Clark"];
const TYPES = ["Pneumatic - Sit Down","Electric - Stand-up Reach Narrow Aisle","Electric - Pneumatic Sit-down 3-Wheel","Cushion - Sit Down","Electric - Pallet Jack","Electric - Order Picker"];
const SOLD_TO = ["UMC Energy Solutions","Vuba Stone","Matrix Electric Company Inc.","American Industrial Inspection","Catalyst Foods","Sunshine Metals, Inc.","Silver sevens hotel & casino","Maras and son cabinetry","Christopher N","Xcimer","MatterHackers","Lone Star Logistics","BuildRight Co","Drayton & Sons","Not Availible"];
const REPNAMES = ["Sunny Coleman","David van Driel","Fabian Nieto","Steven Light","Manuel Doctor","Ilea Miller","Jennie Kehayas","Aaron G & Sunny","Marcus Webb","Dana Ortiz","Priya Shah","Cole Jensen","Renata Diaz","Sam Okafor"];

function rng(seed){ return () => (seed = (seed*1103515245+12345)&0x7fffffff) / 0x7fffffff; }

/* work-status priority pill model */
function workStatusFor(sale, openWork, rank){
  const code = "P"+rank;
  if(sale==="paid_in_full" && openWork) return { code, label:"● PIF — Open Work", mode:"hot" };
  if(sale==="down_payment" && openWork) return { code, label:"Down Pmt — Open Work", mode:"open" };
  if(sale==="paid_in_full")            return { code, label:"Paid in Full ✓", mode:"done" };
  if(sale==="down_payment")            return { code, label:"Down Payment ✓", mode:"done" };
  if(sale==="govt_po")                 return { code, label:"Govt PO — Open Work", mode:"open" };
  return { code, label:"Open Work", mode:"open" };
}

/* ---- SOLD table rows (representative sample of the 175) ---- */
function buildSold(){
  const r = rng(11);
  const rows = [];
  // mix: ~46% PIF, ~45% down payment, ~9% govt; ~60% have open work
  for(let i=0;i<46;i++){
    const sr = r();
    const sale = sr<0.46 ? "paid_in_full" : sr<0.91 ? "down_payment" : "govt_po";
    const openWork = sale==="govt_po" ? false : r()<0.62;
    const signed = sale==="govt_po" ? true : r()>0.18;
    const loc = ["DFW","DFW","DFW","Denver","Vegas","Phoenix"][Math.floor(r()*6)];
    const cap = [3500,4000,5000,6000,8000,10000,12000][Math.floor(r()*7)];
    // priority rank: open work first (P1..), settled later (P5..P9)
    const rank = openWork ? (sale==="paid_in_full"?1: (sale==="govt_po"?3:4)) : (sale==="paid_in_full"?9:5);
    rows.push({
      id:"S"+i, name:NAMES[i%NAMES.length],
      serial:(100+Math.floor(r()*899))+["E","R","M","U","T","Y","P","K"][Math.floor(r()*8)],
      make:MAKES_WEIGHTED[Math.floor(r()*MAKES_WEIGHTED.length)],
      type:TYPES[Math.floor(r()*TYPES.length)],
      capacity:cap, location:loc, sale,
      soldTo:SOLD_TO[Math.floor(r()*SOLD_TO.length)],
      rep:REPNAMES[Math.floor(r()*REPNAMES.length)],
      invoiced: r()>0.05,
      pandadoc: signed ? "signed" : "pending",
      openWork,
      workStatus: workStatusFor(sale, openWork, rank),
      price: 12000 + Math.floor(r()*40000),
    });
  }
  // sort by priority rank then open work
  rows.sort((a,b)=> (a.workStatus.code.localeCompare(b.workStatus.code)) || (b.openWork-a.openWork));
  return rows;
}
const SOLD_ROWS = buildSold();

/* ---- general units sample (All Units / Priority / Sales tabs) ---- */
function buildUnits(){
  const r = rng(7);
  const works = ["ready","ready","working","working","working","needs_diagnosis","needs_diagnosis","on_rent","sold"];
  const out=[];
  for(let i=0;i<160;i++){
    const work = works[Math.floor(r()*works.length)];
    const make = MAKES_WEIGHTED[Math.floor(r()*MAKES_WEIGHTED.length)];
    const loc = ["Denver","DFW","Vegas","Phoenix"][Math.floor(r()*4)];
    const cap = [3500,4000,5000,6000,8000,10000][Math.floor(r()*6)];
    let sale="unknown", committed=false, signed=false, customer=null, soldBy=null, price=null;
    const committedUnfinished = (work==="working"||work==="needs_diagnosis") && r()<0.32;
    if(work==="sold"||committedUnfinished){
      const sr=r(); sale = sr<0.46?"paid_in_full":sr<0.91?"down_payment":"govt_po";
      committed=true; signed = sale==="govt_po"?true:r()>0.4;
      customer=SOLD_TO[Math.floor(r()*SOLD_TO.length)]; soldBy=REPNAMES[Math.floor(r()*REPNAMES.length)];
      price=12000+Math.floor(r()*40000);
    } else if(work==="on_rent"){ sale="rental"; price=1800+Math.floor(r()*2200); }
    else { price = work==="ready"?14000+Math.floor(r()*30000):null; }
    out.push({ id:"U"+(1000+i), rowIndex:i, name:r()>0.4?NAMES[i%NAMES.length]:null,
      serial:make.slice(0,2).toUpperCase()+"-"+(10000+Math.floor(r()*89999)),
      make, model:make[0]+Math.floor(10+r()*80), type:TYPES[Math.floor(r()*TYPES.length)],
      location:loc, capacity:cap, work, sale, price, customer, soldBy, committed, signed });
  }
  return out;
}
const UNITS = buildUnits();

/* ---- sales reps (leaderboard) ---- */
function buildReps(){
  const r = rng(5);
  return REPNAMES.slice(0,14).map((n,i)=>{
    const unitsSold = Math.max(0, 14 - i + Math.floor(r()*4));
    const avg = 22000 + Math.floor(r()*26000);
    return { name:n, location:["DFW","Denver","Phoenix","Vegas"][i%4], unitsSold,
      totalSale:unitsSold*avg, avgSale:unitsSold?avg:null,
      emailsSent:[412,388,356,331,291,247,210,188,160,142,120,98,76,54][i],
      unsignedDocs: i<6 ? Math.floor(r()*3) : 0, title:i===0?"Senior Rep":"Rep" };
  });
}
const REPS = buildReps();

const SCHEMA_COLUMNS = [
  { name:"Unit Name", role:"identifier", trust:"high", veto:false },
  { name:"Serial #", role:"identifier", trust:"high", veto:false },
  { name:"Make / Brand", role:"dimension", trust:"high", veto:false },
  { name:"Type", role:"dimension", trust:"high", veto:false },
  { name:"Yard Location", role:"dimension", trust:"high", veto:false },
  { name:"Capacity (lbs)", role:"measure", trust:"medium", veto:false },
  { name:"Work Stage", role:"status", trust:"high", veto:false },
  { name:"Sale Type", role:"status", trust:"high", veto:false },
  { name:"Sold To", role:"attribution", trust:"high", veto:false },
  { name:"Rep", role:"attribution", trust:"medium", veto:false },
  { name:"Invoiced", role:"flag", trust:"high", veto:false },
  { name:"PandaDoc Signed", role:"flag", trust:"medium", veto:false },
  { name:"Sale Price", role:"measure", trust:"high", veto:false },
  { name:"email::campaign", role:"entity", trust:"medium", veto:false },
  { name:"round_robin::next", role:"entity", trust:"medium", veto:false },
  { name:"misc_notes_3", role:"unknown", trust:"low", veto:true },
];

const ROUND_ROBIN = [
  { queue:"DFW — Inbound Web", assignee:"David van Driel" },
  { queue:"Denver — Phone", assignee:"Ilea Miller" },
  { queue:"Phoenix — Govt / Fleet", assignee:"Priya Shah" },
  { queue:"Vegas — Marketplace", assignee:"Manuel Doctor" },
];
const LEAD_SOURCES = [
  { source:"Google / Organic", count:184 },
  { source:"Marketplace", count:142 },
  { source:"Referral", count:96 },
  { source:"Phone Walk-in", count:71 },
  { source:"Email Campaign", count:48 },
];

Object.assign(window, {
  FLEET, LEADS, LOCATIONS, FILTER_LOCS, SOLD_ROWS, UNITS, REPS, SCHEMA_COLUMNS, ROUND_ROBIN, LEAD_SOURCES,
  WORK_LABEL, WORK_HEX, WORK_PILL, SALE_LABEL, SALE_PILL, TIER_LABEL, TIER_PILL,
});
