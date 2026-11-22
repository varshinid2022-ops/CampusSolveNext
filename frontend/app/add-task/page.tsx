"use client";

import { FormEvent, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function AddTaskPage() {
  const router=useRouter();
  const [form,setForm]=useState({title:"",description:"",category:"College",priority:"Medium",due_date:"",status:"Pending",progress:0});
  const [error,setError]=useState("");
  function update(key:string,value:string|number){setForm(current=>({...current,[key]:value}));}
  async function submit(event:FormEvent){
    event.preventDefault(); setError("");
    try{await api("/tasks",{method:"POST",body:JSON.stringify({...form,due_date:form.due_date||null})}); router.push("/tasks");}
    catch(err){setError(err instanceof Error?err.message:"Could not add task");}
  }
  return (
    <Shell page="add-task-desk">
      <div className="hero"><div><h1>Add Task</h1><p>Capture a goal and give it a clear deadline.</p></div></div>
      <form className="panel" onSubmit={submit}>
        {error&&<div className="error">{error}</div>}
        <div className="field"><label>Title</label><input value={form.title} onChange={e=>update("title",e.target.value)} required /></div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={e=>update("description",e.target.value)} /></div>
        <div className="grid" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
          <div className="field"><label>Category</label><select value={form.category} onChange={e=>update("category",e.target.value)}>{["College","Assignment","Examination","Project","Personal","Programming","Other"].map(v=><option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>Priority</label><select value={form.priority} onChange={e=>update("priority",e.target.value)}><option>High</option><option>Medium</option><option>Low</option></select></div>
          <div className="field"><label>Status</label><select value={form.status} onChange={e=>update("status",e.target.value)}><option>Pending</option><option>In Progress</option><option>Completed</option><option>Overdue</option></select></div>
        </div>
        <div className="grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>
          <div className="field"><label>Due date</label><input type="date" value={form.due_date} onChange={e=>update("due_date",e.target.value)} /></div>
          <div className="field"><label>Progress</label><input type="range" min="0" max="100" value={form.progress} onChange={e=>update("progress",Number(e.target.value))} /></div>
        </div>
        <button className="btn" type="submit">Save task</button>
      </form>
    </Shell>
  );
}
