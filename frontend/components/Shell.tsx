"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

const links = [
  ["/dashboard", "Dashboard", "⌂"],
  ["/tasks", "My Tasks", "✓"],
  ["/add-task", "Add Task", "+"],
  ["/calendar", "Calendar", "▦"],
  ["/analytics", "Analytics", "⌁"],
  ["/reports", "Reports", "≡"],
  ["/notifications", "Notifications", "◌"],
  ["/profile", "Profile", "●"],
  ["/settings", "Settings", "⚙"],
  ["/about", "About", "i"],
] as const;

export default function Shell({ children, page }: { children: ReactNode; page: string; pageName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("campussolve_token")) router.replace("/login");
    else setReady(true);
  }, [router]);

  if (!ready) return <main className="loading-screen">Loading CampusSolve...</main>;

  function logout() {
    localStorage.removeItem("campussolve_token");
    localStorage.removeItem("campussolve_user");
    router.replace("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>CS</span><strong>CampusSolve</strong></div>
        <nav>
          {links.map(([href, label, icon]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              <b>{icon}</b><span>{label}</span>
            </Link>
          ))}
        </nav>
        <button className="logout" onClick={logout}>Log out</button>
      </aside>
      <main className="main-content">
        <div className="page-image" style={{ backgroundImage: `url(/assets/images/${page}.jpg)` }} />
        <div className="page-overlay" />
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
