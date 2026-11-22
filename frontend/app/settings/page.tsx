"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

export default function SettingsPage(){
 const [theme,setTheme]=useState("Emerald Green + Black");
 const palettes=["Emerald Green + Black","Peach Sunset","Burgundy Rose","Royal Purple","Emerald Green","Sunset Orange","Black Gold","Sky Blue","Rose Pink","Indigo Silver","Coffee Cream"];
 async function saveTheme(p:string){setTheme(p);try{await api("/settings/theme",{method:"PUT",body:JSON.stringify({theme:p==="Emerald Green + Black"?"emerald_black":p.toLowerCase().replaceAll(" ","_")})});}catch{}}
 return <Shell page="settings-minimal"><div className="hero"><div><h1>Settings</h1><p>Personalize your CampusSolve experience.</p></div></div><div className="panel"><h3>Colour theme</h3> <div className="toolbar">{palettes.map(p=><button key={p} className={theme===p?"btn":"btn secondary"} style={{width:"auto"}} onClick={()=>saveTheme(p)}>{p}</button>)}</div><p className="muted">Selected: {theme}</p></div></Shell>
}
