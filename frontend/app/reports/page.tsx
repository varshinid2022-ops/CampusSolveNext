"use client";

import Shell from "@/components/Shell";
import { API_URL, getToken } from "@/lib/api";

async function download(path:string,filename:string){
 const response=await fetch(`${API_URL}${path}`,{headers:{Authorization:`Bearer ${getToken()}`}});
 const blob=await response.blob();
 const url=URL.createObjectURL(blob); const anchor=document.createElement("a");
 anchor.href=url; anchor.download=filename; anchor.click(); URL.revokeObjectURL(url);
}

export default function ReportsPage(){
 return <Shell page="reports-office"><div className="hero"><div><h1>Reports</h1><p>Export and review your progress.</p></div></div><div className="cards-grid"><div className="panel"><h3>CSV export</h3><p className="muted">Download user-specific task records.</p><button className="btn" onClick={()=>download("/reports/csv","campussolve_tasks.csv")}>Download CSV</button></div><div className="panel"><h3>JSON export</h3><p className="muted">Download structured task records.</p><button className="btn" onClick={()=>download("/reports/json","campussolve_tasks.json")}>Download JSON</button></div><div className="panel"><h3>Progress report</h3><p className="muted">Summary values come from SQLite.</p></div></div></Shell>
}
