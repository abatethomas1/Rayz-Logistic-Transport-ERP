import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Anchor,
  Truck,
  Wallet,
  BarChart3,
  Bell,
  Search,
  ChevronRight,
  Menu,
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui";
import { roles, canView, canApprove } from "./model";
import { useWorkspace } from "./store";
import { navigation, sectionForPath, visibleSection, type NavigationSection } from "./navigation";
import { WorkPanel } from "./approval-workspace";
import { departmentFor, type Department } from "./approval-model";
import { useStaffAuth } from "./auth";
import { toast } from "sonner";
import { CompanyLogo } from './company-logo';
const modules = [
  { label: "Logistics", icon: Anchor },
  { label: "Transport", icon: Truck },
  { label: "Finance", icon: Wallet },
  { label: "Reports", icon: BarChart3 },
];
function SectionLink({
  section,
  children,
  ...props
}: {
  section: NavigationSection;
  children: ReactNode;
  className?: string;
  role?: string;
  "aria-selected"?: boolean;
  onClick?: () => void;
}) {
  return section.path ? (
    <Link to={section.path} {...props}>
      {children}
    </Link>
  ) : (
    <Link to="/workspaces/$section" params={{ section: section.key }} {...props}>
      {children}
    </Link>
  );
}
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { role, operations, invoices, trips, costs, actor, work, company } = useWorkspace();
  const { signOut, session, selectCompany } = useStaffAuth();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const pending = work.filter((w) => w.status === "Submitted" && (actor.general || departmentFor(w.area) === actor.department)).length;
  const active =
    location.pathname === "/reports"
      ? navigation.find((s) => s.module === "Reports" && visibleSection(role, s))
      : sectionForPath(location.pathname);
  const shared = location.pathname.startsWith("/operations") || location.pathname === "/customers";
  const current = shared ? "Freight Operations" : active?.label || "Workspace";
  const visibleGroups = navigation.filter(
    (s) => s.module === active?.module && visibleSection(role, s),
  );
  const q = query.toLowerCase();
  const matches = query
    ? operations
        .filter((o) =>
          [
            o.id,
            o.customer,
            ...o.containers,
            ...trips.filter((t) => t.operationId === o.id).map((t) => t.truck),
            ...invoices.filter((i) => i.operationId === o.id).map((i) => i.id),
          ].some((v) => v.toLowerCase().includes(q)),
        )
        .slice(0, 5)
    : [];
  const moduleLinks = modules.filter((m) => company.enabled_modules.includes(m.label.toLowerCase())).flatMap((m) => {
    const section = navigation.find((s) => s.module === m.label && visibleSection(role, s)) || navigation.find((s) => s.module === m.label);
    return section ? [{ m, section }] : [];
  });
  return (
    <div className="workspace">
      <header className="app-header">
        <Link to="/" className="brand">
          <CompanyLogo company={company} />
          <div className="brand-name">
            {company.branding.display_name || company.name}<small>LOGISTICS &amp; TRANSPORT ERP</small>
          </div>
        </Link>
        <nav className="header-nav" aria-label="Modules">
          {moduleLinks.map(({ m, section }) => {
            const count = m.label === "Finance" ? pending : 0;
            return (
              <SectionLink
                key={m.label}
                section={section}
                className={`header-nav-item ${active?.module === m.label ? "active" : ""}`}
              >
                <m.icon />
                <span>{m.label}</span>
                {count > 0 && <span className="nav-count">{count}</span>}
              </SectionLink>
            );
          })}
        </nav>
        <div className="header-actions">
          {(session?.memberships.length ?? 0) > 1 && <select aria-label="Active company" value={company.company} onChange={(e) => void selectCompany(e.target.value).catch((err: Error) => toast.error(err.message))}>{session?.memberships.map((m) => <option key={m.id} value={m.company}>{m.branding.display_name || m.name}</option>)}</select>}
          <a href="/navigation.md" target="_blank" rel="noreferrer" className="header-nav-item">
            <BookOpen />
            <span>Sitemap</span>
            <ArrowUpRight size={13} />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </Button>
        </div>
        {mobile && (
          <nav className="header-nav-mobile" aria-label="Modules">
            {moduleLinks.map(({ m, section }) => {
              const count = m.label === "Finance" ? pending : 0;
              return (
                <SectionLink
                  key={m.label}
                  section={section}
                  className={`header-nav-item ${active?.module === m.label ? "active" : ""}`}
                  onClick={() => setMobile(false)}
                >
                  <m.icon />
                  <span>{m.label}</span>
                  {count > 0 && <span className="nav-count">{count}</span>}
                </SectionLink>
              );
            })}
          </nav>
        )}
      </header>
      <div className="app-area">
        <header className="topbar">
          <div className="breadcrumb">
            <Link to="/operations" className="record-link">
              Freight Operations
            </Link>
            <ChevronRight size={12} />
            <strong>{current}</strong>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <div className="search-input">
                <Search size={14} />
                <input
                  aria-label="Global search"
                  placeholder="Search operations, customers…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {query && (
                <div className="search-results">
                  {matches.map((o) => (
                    <Link
                      key={o.id}
                      to="/operations/$operationId"
                      params={{ operationId: o.id }}
                      onClick={() => setQuery("")}
                    >
                      <strong>{o.id}</strong>
                      <small>{o.customer}</small>
                    </Link>
                  ))}
                  {!matches.length && <p className="p-3">No matching records</p>}
                </div>
              )}
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="notification-dot"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell />
              </Button>
              {notifications && (
                <div className="search-results w-64 left-auto right-0">
                  <strong className="block p-3 text-xs">Pending attention</strong>
                  {canApprove(role, active?.area) && (
                    <p className="p-3">{pending} department submissions await review</p>
                  )}
                  <p className="p-3">Assigned work and department approvals</p>
                </div>
              )}
            </div>
            <div className="user-menu">
              <div className="user-avatar">{actor.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</div>
              <div>
                <strong className="user-name">{actor.name}</strong>
                <span className="block text-xs text-muted-foreground">{role}</span>
              </div>
              <Button asChild variant="ghost" size="sm"><Link to="/staff">Account</Link></Button>
              <Button variant="ghost" size="sm" onClick={() => void signOut().catch((e: Error) => toast.error(e.message))}>Sign out</Button>
            </div>
          </div>
        </header>
        <main className="main-content">
          <div className="module-tabs">
            <div
              className="module-tabs-row"
              role="tablist"
              aria-label={`${active?.module || "Freight Operations"} submodules`}
            >
              {visibleGroups.map((g) => (
                <SectionLink
                  key={g.key}
                  section={g}
                  role="tab"
                  aria-selected={g === active}
                  className={`module-tab ${g === active ? "active" : ""}`}
                >
                  {g.label}
                </SectionLink>
              ))}
              {shared && (
                <>
                  <Link
                    to="/operations"
                    className={`module-tab ${location.pathname !== "/customers" ? "active" : ""}`}
                  >
                    Operation Files
                  </Link>
                  <Link
                    to="/customers"
                    className={`module-tab ${location.pathname === "/customers" ? "active" : ""}`}
                  >
                    Customers
                  </Link>
                </>
              )}
            </div>
          </div>
          {location.pathname !== '/' && active && !visibleSection(role, active) ? <PermissionGate area={active.area}><EmptyRestricted /></PermissionGate> : <>
            {active && active.module !== "Reports" && !active.key.endsWith("approvals") && ["logistics", "transport", "finance"].includes(active.area) && <WorkPanel department={active.area as Department} {...(active.key === "external-logistics" ? { initialArea: "external" as const } : active.key === "internal-logistics" ? { initialArea: "internal" as const } : {})} />}
            {children}
          </>}
          <footer className="footer">
            <span>© 2026 {company.name} · Rayz Technologies PLC</span>
            <span>
              <i />
              Connected workspace · records saved permanently
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export function PermissionGate({ area, children }: { area: string; children: ReactNode }) {
  const { role } = useWorkspace();
  return canView(role, area) ? (
    <>{children}</>
  ) : (
    <div className="permission-empty">
      <ShieldCheck size={36} />
      <h1>Restricted workspace</h1>
      <p>{role} does not have access to this department view.</p>
      <Button asChild variant="outline" className="mt-5">
        <Link to="/operations">View freight operations</Link>
      </Button>
    </div>
  );
}

function EmptyRestricted() { return <p className="permission-empty">This section is outside your assigned work area.</p>; }
