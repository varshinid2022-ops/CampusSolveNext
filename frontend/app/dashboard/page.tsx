"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

type Metrics = {total:number;completed:number;pending:number;overdue:number;today:number;completion:number};

export default function DashboardPage() {
  const [metrics,setMetrics] = useState<Metrics|null>(null);
  useEffect(() => { api<Metrics>("/dashboard").then(setMetrics).catch(()=>setMetrics(null)); },[]);
  return (
    <Shell page="dashboard-workspace" pageName="Dashboard">
      <div className="hero"><div><h1>Welcome back</h1><p>Turn plans into progress, one task at a time.</p></div></div>
      <div className="grid">
        <div className="panel metric"><span>Total tasks</span><strong>{metrics?.total ?? 0}</strong></div>
        <div className="panel metric"><span>Pending</span><strong>{metrics?.pending ?? 0}</strong></div>
        <div className="panel metric"><span>Completed</span><strong>{metrics?.completed ?? 0}</strong></div>
        <div className="panel metric"><span>Overdue</span><strong>{metrics?.overdue ?? 0}</strong></div>
      </div>
      <div className="cards-grid" style={{marginTop:16}}>
        <div className="panel"><h3>Completion progress</h3><strong style={{fontSize:"2.5rem",color:"#A7F3D0"}}>{metrics?.completion ?? 0}%</strong><div className="progress"><span style={{width:`${metrics?.completion ?? 0}%`}}/></div></div>
        <div className="panel"><h3>Due today</h3><strong style={{fontSize:"2.5rem",color:"#A7F3D0"}}>{metrics?.today ?? 0}</strong></div>
        <div className="panel"><h3>Quick actions</h3><a className="btn" href="/add-task" style={{display:"block",textAlign:"center",textDecoration:"none"}}>Add a task</a></div>
      </div>
    </Shell>
  );
}
