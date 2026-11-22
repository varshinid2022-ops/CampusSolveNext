"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

type Task={id:number;title:string;due_date:string|null;status:string};

export default function CalendarPage(){
  const [tasks,setTasks]=useState<Task[]>([]);
  useEffect(()=>{api<Task[]>("/tasks").then(setTasks).catch(()=>setTasks([]));},[]);
  const today=new Date();
  const year=today.getFullYear(), month=today.getMonth();
  const days=new Date(year,month+1,0).getDate();
  const first=new Date(year,month,1).getDay();
  return <Shell page="calendar-agenda"><div className="hero"><div><h1>{today.toLocaleString("en",{month:"long",year:"numeric"})}</h1><p>Plan deadlines and manage your time.</p></div></div><div className="panel" style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><strong key={d} style={{color:"#A7F3D0",textAlign:"center"}}>{d}</strong>)}
    {Array.from({length:first}).map((_,i)=><span key={`e${i}`}/>)}
    {Array.from({length:days}).map((_,i)=>{
      const date=(`${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`);
      const count=tasks.filter(t=>t.due_date===date).length;
      return <div key={date} className="panel" style={{padding:10,minHeight:72}}><strong>{i+1}</strong>{count>0&&<p style={{color:"#A7F3D0",fontSize:12}}>{count} task(s)</p>}</div>
    })}
  </div></Shell>
}
