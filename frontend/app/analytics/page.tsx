"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

type Metrics={total:number;completed:number;pending:number;overdue:number;completion:number};

export default function AnalyticsPage(){
 const [m,setM]=useState<Metrics|null>(null);
 useEffect(()=>{api<Metrics>("/dashboard").then(setM).catch(()=>setM(null));},[]);
 return <Shell page="analytics-screen"><div className="hero"><div><h1>Analytics</h1><p>Real productivity insights from your tasks.</p></div></div><div className="grid">
  <div className="panel metric"><span>Completion rate</span><strong>{m?.completion??0}%</strong></div>
  <div className="panel metric"><span>Completed</span><strong>{m?.completed??0}</strong></div>
  <div className="panel metric"><span>Pending</span><strong>{m?.pending??0}</strong></div>
  <div className="panel metric"><span>Overdue</span><strong>{m?.overdue??0}</strong></div>
 </div><div className="cards-grid" style={{marginTop:16}}><div className="panel"><h3>Completed vs pending</h3><div className="progress"><span style={{width:`${m?.completion??0}%`}}/></div></div><div className="panel"><h3>Task volume</h3><strong>{m?.total??0}</strong></div><div className="panel"><h3>Overdue statistics</h3><strong>{m?.overdue??0}</strong></div></div></Shell>
}
