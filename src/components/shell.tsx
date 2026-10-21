import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  Files,
  Users,
  Settings,
  LogOut,
  ArrowUpRight,
  BookOpen,
  ShoppingCart,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { logout } from "@/app/login/submit";
export function Shell({
  children,
  active = "Dashboard",
  email = "",
}: {
  children: React.ReactNode;
  active?: string;
  email?: string;
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">L</span> ledger
          <span className="brand-dot">.</span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            [LayoutDashboard, "Dashboard", "/"],
            [FileText, "Invoices", "/invoices"],
            [Files, "Quotations", "/quotations"],
            [Users, "Customers", "/customers"],
            [ClipboardList, "Sales Orders", "/accounting/sales-orders"],
            [ShoppingCart, "Purchase Orders", "/accounting/purchase-orders"],
            [Users, "Suppliers", "/accounting/suppliers"],
            [BookOpen, "Accounting", "/accounting/journals"],
            [BarChart3, "Reports", "/accounting/profit-loss"],
            [Settings, "Settings", "/settings"],
          ].map(([Icon, label, href]) => {
            const I = Icon as typeof FileText;
            return (
              <Link
                key={String(label)}
                href={String(href)}
                className={active === label ? "active" : ""}
              >
                <I size={19} />
                {String(label)}
                {active === label && <span className="nav-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-note">
            <span className="live-dot" /> A place for every document
            <p>Saved securely. Ready whenever you are.</p>
          </div>
          <form action={logout}>
            <button className="profile">
              <span className="avatar">
                {email.slice(0, 1).toUpperCase() || "U"}
              </span>
              <span>
                <strong>Your workspace</strong>
                <small>{email}</small>
              </span>
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <strong>{active}</strong>
          </span>
          <span className="topbar-right">
            <span className="live-dot" /> Secure workspace{" "}
            <ArrowUpRight size={14} />
          </span>
        </header>
        <main className="main">{children}</main>
        <footer className="app-footer">
          Every detail, in order.<span>LEDGER · DOCUMENTS, ORDERS & ACCOUNTING</span>
        </footer>
      </div>
    </div>
  );
}
