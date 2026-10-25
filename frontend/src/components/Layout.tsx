import { Building2, FolderCheck, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { resetDemo } from "../api/demo";
import { signOut, type SessionUser } from "../lib/auth";
import { demoMode, exitDemo } from "../lib/config";
import { cx } from "../lib/format";
import { useHub } from "../lib/queries";
import { Logo } from "./ui";

const NAV: Array<{ to: string; label: string; icon: ReactNode; end?: boolean }> = [
  { to: "/", label: "Hub dashboard", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: "/clients", label: "SMME clients", icon: <Building2 className="h-4 w-4" /> },
  { to: "/readiness", label: "Document readiness", icon: <FolderCheck className="h-4 w-4" /> },
  { to: "/settings", label: "Hub settings", icon: <Settings className="h-4 w-4" /> },
];

function DemoBanner() {
  if (!demoMode) return null;
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
      <span>Demo mode: simulated data and AI responses, with no AWS backend.</span>
      <button
        className="underline underline-offset-2"
        onClick={() => {
          resetDemo();
          window.location.reload();
        }}
      >
        Reset demo data
      </button>
      <button className="underline underline-offset-2" onClick={exitDemo}>
        Use live backend
      </button>
    </div>
  );
}

export function Layout({ user, onSignedOut }: { user: SessionUser; onSignedOut: () => void }) {
  const [open, setOpen] = useState(false);
  const hub = useHub();
  const navigate = useNavigate();

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )
          }
        >
          {n.icon}
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-sm font-medium text-white">{hub.data?.hubName || "Your hub"}</p>
      <p className="truncate text-xs text-slate-400">{user.name ? `${user.name} · ` : ""}{user.email}</p>
      <button
        className="mt-3 flex items-center gap-2 text-sm text-slate-300 hover:text-white"
        onClick={async () => {
          await signOut();
          onSignedOut();
          navigate("/");
        }}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <DemoBanner />
      {/* Mobile header */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden">
        <Logo light />
        <button className="rounded-lg p-2 text-white hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-40 bg-navy-950/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col justify-between bg-navy-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="mb-6 flex items-center justify-between">
                <Logo light />
                <button className="rounded-lg p-2 text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
            </div>
            {account}
          </aside>
        </div>
      )}
      <div className="flex">
        <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-navy-900 p-5 lg:flex">
          <div>
            <div className="mb-8">
              <Logo light />
              <p className="mt-2 text-xs text-slate-400">Digital compliance officer for SMME hubs</p>
            </div>
            {nav}
          </div>
          {account}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
