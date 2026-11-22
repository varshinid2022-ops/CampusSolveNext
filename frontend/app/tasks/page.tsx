"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

type Task = {id:number;title:string;description:string;category:string;priority:string;due_date:string|null;status:string;progress:number};

export default function TasksPage() {
  const [tasks,setTasks]=useState<Task[]>([]);
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("All");
  const [priority,setPriority]=useState("All");
  const [status,setStatus]=useState("All");

  async function load() {
    const params=new URLSearchParams({search,category,priority,status,sort:"Newest"});
    setTasks(await api<Task[]>(`/tasks?${params}`));
  }
  useEffect(()=>{load().catch(()=>setTasks([]));},[]);

  async function remove(id:number) {
    if (!confirm("Delete this task permanently?")) return;
    await api(`/tasks/${id}`,{method:"DELETE"});
    await load();
  }

  async function complete(task:Task) {
    await api(`/tasks/${task.id}`,{method:"PUT",body:JSON.stringify({...task,status:task.status==="Completed"?"Pending":"Completed",progress:task.status==="Completed"?0:100})});
    await load();
  }

  return (
    <Shell page="tasks-notebook">
      <div className="hero"><div><h1>My Tasks</h1><p>Search, organize, and complete every goal.</p></div></div>
      <div className="toolbar">
        <input placeholder="Search tasks" value={search} onChange={e=>setSearch(e.target.value)} />
        <select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option>{["College","Assignment","Examination","Project","Personal","Programming","Other"].map(v=><option key={v}>{v}</option>)}</select>
        <select value={priority} onChange={e=>setPriority(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select>
        <select value={status} onChange={e=>setStatus(e.target.value)}><option>All</option><option>Pending</option><option>In Progress</option><option>Completed</option><option>Overdue</option></select>
        <button className="btn" style={{width:"auto"}} onClick={load}>Apply filters</button>
      </div>
      <div style={{display:"grid",gap:12}}>
        {tasks.length===0 && <div className="panel"><h3>No tasks found</h3><p className="muted">Add a task or adjust your filters.</p></div>}
        {tasks.map(task=>(
          <div className="panel task-row" key={task.id}>
            <div><h3 style={{margin:"0 0 6px"}}>{task.title}</h3><p className="muted">{task.description||"No description"}</p><p>{task.category} · {task.priority} · {task.status} · Due {task.due_date||"No date"}</p><div className="progress"><span style={{width:`${task.progress}%`}} /></div></div>
            <div className="task-actions"><button onClick={()=>complete(task)}>{task.status==="Completed"?"Reopen":"Complete"}</button><button onClick={()=>remove(task.id)}>Delete</button></div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
