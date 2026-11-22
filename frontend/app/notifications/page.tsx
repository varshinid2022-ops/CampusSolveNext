"use client";

import { useEffect,useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

type Notice={id:number;title:string;message:string;is_read:number;created_at:string};
export default function NotificationsPage(){const [notices,setNotices]=useState<Notice[]>([]);useEffect(()=>{api<Notice[]>("/notifications").then(setNotices).catch(()=>setNotices([]));},[]);return <Shell page="notifications-focus"><div className="hero"><div><h1>Notifications</h1><p>Your latest task updates.</p></div></div><div style={{display:"grid",gap:12}}>{notices.length===0&&<div className="panel"><h3>No notifications</h3><p className="muted">Task updates will appear here.</p></div>}{notices.map(n=><div className="panel" key={n.id}><h3>{n.title}</h3><p>{n.message}</p><span className="muted">{n.created_at}</span></div>)}</div></Shell>}
