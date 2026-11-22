"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

export default function ProfilePage(){
 const [user,setUser]=useState<{full_name:string;username:string;email:string}|null>(null);
 const [oldPassword,setOldPassword]=useState("");
 const [newPassword,setNewPassword]=useState("");
 const [message,setMessage]=useState("");
 useEffect(()=>{api<{full_name:string;username:string;email:string}>("/me").then(setUser).catch(()=>setUser(null));},[]);
 async function saveProfile(){if(!user)return;try{const saved=await api<{full_name:string;username:string;email:string}>("/profile",{method:"PUT",body:JSON.stringify(user)});setUser(saved);setMessage("Profile saved.");}catch(e){setMessage(e instanceof Error?e.message:"Could not save profile");}}
 async function savePassword(){try{await api("/profile/password",{method:"PUT",body:JSON.stringify({current_password:oldPassword,new_password:newPassword})});setMessage("Password changed.");setOldPassword("");setNewPassword("");}catch(e){setMessage(e instanceof Error?e.message:"Could not change password");}}
 return <Shell page="profile-studio"><div className="hero"><div><h1>Profile</h1><p>Manage your CampusSolve account.</p></div></div>{message&&<div className="panel">{message}</div>}<div className="cards-grid"><div className="panel"><h3>Account</h3>{user&&<>
 <div className="field"><label>Full name</label><input value={user.full_name} onChange={e=>setUser({...user,full_name:e.target.value})}/></div>
 <div className="field"><label>Username</label><input value={user.username} onChange={e=>setUser({...user,username:e.target.value})}/></div>
 <div className="field"><label>Email</label><input value={user.email} onChange={e=>setUser({...user,email:e.target.value})}/></div>
 <button className="btn" onClick={saveProfile}>Save profile</button></>}</div>
 <div className="panel"><h3>Password</h3><div className="field"><label>Current password</label><input type="password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)} /></div><div className="field"><label>New password</label><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></div><button className="btn" onClick={savePassword}>Change password</button></div></div></Shell>
}
