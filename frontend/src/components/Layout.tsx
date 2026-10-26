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

  async function handleSignOut() {
    await signOut();
    onSignedOut();
    navigate("/");
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    cx(
      "flex items-center gap-2 border-b-[3px] font-nav text-[13px] font-bold uppercase tracking-wide transition",
      isActive ? "border-accent-500 text-brand-600" : "border-transparent text-navy-900 hover:text-accent-500",
    );

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />

      {/* Utility bar */}
      <div className="no-print bg-brand-600 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-1.5 font-nav text-[13px] sm:px-6">
          <span className="truncate">
            <span className="font-bold">{hub.data?.hubName || "Your hub"}</span>
            <span className="hidden text-white/75 sm:inline">
              {" "}
              · {user.name ? `${user.name} · ` : ""}
              {user.email}
            </span>
          </span>
          <button className="flex shrink-0 items-center gap-1.5 hover:text-accent-500" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Main header */}
      <header className="no-print sticky top-0 z-30 bg-white shadow-[0_0_20px_rgba(21,47,95,0.2)]">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <NavLink to="/" aria-label="TenderReady home">
            <Logo />
          </NavLink>
          <nav className="hidden h-full items-stretch gap-7 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={link}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className="p-2 text-navy-900 hover:text-accent-500 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav className="border-t-4 border-accent-500 bg-white lg:hidden">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-3 border-b border-[#dfe3e4] px-4 py-3 font-nav text-[13px] font-bold uppercase tracking-wide",
                    isActive ? "bg-brand-50 text-brand-600" : "text-navy-900",
                  )
                }
              >
                {n.icon}
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="min-w-0 flex-1 py-8 lg:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Outlet />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print bg-footer text-[13px] leading-6 text-[#9a9a9a]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <h6 className="mb-3 font-nav text-sm font-bold uppercase tracking-wide text-white">About TenderReady</h6>
          <p>
            TenderReady helps SMME hubs, incubators and business support centres prepare compliant public-sector bids. It reads tender
            documents and lists the forms, certificates and conditions each client needs. It supports bid preparation and does not
            guarantee eligibility or award.
          </p>
        </div>
        <div>
          <h6 className="mb-3 font-nav text-sm font-bold uppercase tracking-wide text-white">Hub</h6>
          <ul>
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.end} className="hover:text-accent-500">
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h6 className="mb-3 font-nav text-sm font-bold uppercase tracking-wide text-white">Useful links</h6>
          <ul>
            <li><a className="hover:text-accent-500" href="https://www.etenders.gov.za" target="_blank" rel="noreferrer">eTenders portal</a></li>
            <li><a className="hover:text-accent-500" href="https://secure.csd.gov.za" target="_blank" rel="noreferrer">Central Supplier Database</a></li>
            <li><a className="hover:text-accent-500" href="https://www.bizportal.gov.za" target="_blank" rel="noreferrer">BizPortal</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs sm:px-6">© {new Date().getFullYear()} TenderReady. All rights reserved.</p>
      </div>
    </footer>
  );
}
