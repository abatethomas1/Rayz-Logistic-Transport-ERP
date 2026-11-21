import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, ArrowUpRight, Users, Package, Wallet, BarChart3, Truck, Plus } from "lucide-react";
import { money, financialSummary, dateLabel, canView } from "./model";
import { useWorkspace } from "./store";
import { MasterEditor } from "./master-editor";
import { canMaintainMaster } from "./production-model";
import { AuthorizedReportPanel } from "./report-panel";
import {
  PageHeader,
  SectionHeading,
  SearchInput,
  OperationSelect,
  Modal,
  Button,
  Empty,
  ExportButton,
} from "./ui";
export function Customers() {
  const ws = useWorkspace();
  const [q, setQ] = useState(""),
    [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const customers = ws.customers;
  const rows = customers.filter((c) =>
    [c.name, c.contact, c.industry].some((v) => v.toLowerCase().includes(q.toLowerCase())),
  );
  const customer = customers.find((c) => c.name === selected);
  const ops = ws.operations.filter((o) => o.customer === selected);
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE"
        title="Customer directory"
        description="Customer contacts, freight activity, and billing details."
      >{canMaintainMaster(ws.role, "customer") && <Button onClick={() => setEditing({})}><Plus />Add customer</Button>}</PageHeader>
      <SearchInput value={q} onChange={setQ} placeholder="Search customer, contact, industry…" />
      <div className="customers-grid">
        {rows.map((c) => (
          <article className="customer-card" key={c.name}>
            <div className="customer-initials">{c.initials}</div>
            <h3>{c.name}</h3>
            <p>{c.industry}</p>
            <p>{c.contact}</p>
            <p>{c.phone}</p>
            <div className="customer-bottom">
              <span>{ws.operations.filter((o) => o.customer === c.name).length} operations</span>
              <Button variant="ghost" size="sm" onClick={() => setSelected(c.name)}>
                View customer
                <ArrowUpRight />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <Empty />}
      <Modal open={!!customer} onClose={() => setSelected("")} title={customer?.name || "Customer"}>
        {customer && (
          <>
            <dl className="detail-fields">
              <div>
                <dt>Primary contact</dt>
                <dd>{customer.contact}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{customer.phone}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="break-all">{customer.email}</dd>
              </div>
              <div>
                <dt>Payment terms</dt>
                <dd>{customer.terms}</dd>
              </div>
            </dl>
            {canView(ws.role, "finance") && (
              <div className="note">
                Outstanding balance: ETB{" "}
                {money(
                  ws.invoices
                    .filter((i) => ops.some((o) => o.id === i.operationId))
                    .reduce((s, i) => s + i.amount - i.paid, 0),
                )}
              </div>
            )}
            {canMaintainMaster(ws.role, "customer") && <Button variant="outline" onClick={() => { setEditing({ name: customer.name, contact: customer.contact, email: customer.email, phone: customer.phone, industry: customer.industry, terms: customer.terms }); setSelected(""); }}>Edit customer</Button>}
            <h2>Freight operations</h2>
            {ops.map((o) => (
              <Link
                className="flex justify-between py-3 border-b border-border"
                key={o.id}
                to="/operations/$operationId"
                params={{ operationId: o.id }}
              >
                <span className="record-link">{o.id}</span>
                <span>{o.status}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </>
        )}
      </Modal>
      {editing && <MasterEditor kind="customer" open onClose={() => setEditing(null)} initial={editing} />}
    </>
  );
}
export function Reports() {
  const ws = useWorkspace();
  const allowed = ["Logistics", "Transport", "Finance"].filter((area) => canView(ws.role, area.toLowerCase()));
  const [tab, setTab] = useState(allowed[0] || "Logistics");
  const actual = allowed.includes(tab) ? tab : allowed[0] || "Logistics";
  const [op, setOp] = useState(""), [customer, setCustomer] = useState(""), [status, setStatus] = useState(""), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const department = actual === "Logistics" ? "logistics" : actual === "Transport" ? "transport" : "finance";
  return <><PageHeader title="Operational reports" description="Authorized logistics, transport and finance records" />
    <div className="tabs-line">{allowed.map((t) => <Button key={t} variant="ghost" className={actual === t ? "selected" : ""} onClick={() => { setTab(t); setStatus(""); }}>{t}</Button>)}</div>
    <div className="toolbar px-0"><label className="form-field">From<input aria-label="Report start date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="form-field">To<input aria-label="Report end date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><OperationSelect value={op} onChange={setOp} /><select aria-label="Report customer" value={customer} onChange={(e) => setCustomer(e.target.value)}><option value="">All customers</option>{ws.customers.map((c) => <option key={c.name}>{c.name}</option>)}</select><input aria-label="Report status" placeholder="Status" value={status} onChange={(e) => setStatus(e.target.value)} /></div>
    <AuthorizedReportPanel query={{ department, operationId: op, customer, status, from, to }} />
  </>;
}
