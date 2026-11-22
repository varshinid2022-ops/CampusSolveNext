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

const pageImages: Record<string, string> = {
  "dashboard-workspace": "/assets/images/dashboard/dashboard-workspace.jpg",
  "tasks-notebook": "/assets/images/tasks/tasks-notebook.jpg",
  "add-task-desk": "/assets/images/add_task/add-task-desk.jpg",
  "calendar-agenda": "/assets/images/calendar/calendar-agenda.jpg",
  "analytics-screen": "/assets/images/analytics/analytics-screen.jpg",
  "reports-office": "/assets/images/reports/reports-office.jpg",
  "notifications-focus": "/assets/images/notifications/notifications-focus.jpg",
  "profile-studio": "/assets/images/profile/profile-studio.jpg",
  "settings-minimal": "/assets/images/settings/settings-minimal.jpg",
  "about-programming": "/assets/images/about/about-programming.jpg",
};

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
    <div className="app-shell" data-background-page={page}>
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
        <div
          className="page-image"
          style={{
            backgroundImage:
              `linear-gradient(115deg,rgba(11,11,11,.76),rgba(6,78,59,.58),rgba(11,11,11,.72)),` +
              `url("${pageImages[page] || `/assets/images/${page}.jpg`}")`,
          }}
        />
        <div className="page-overlay" />
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
