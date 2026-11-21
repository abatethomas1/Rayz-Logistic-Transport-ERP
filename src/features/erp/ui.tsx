import { useState, type ReactNode, type FormEvent } from "react";
import { ArrowUpRight, ChevronRight, Download, Plus, Search, X, FileText, FileSpreadsheet } from "lucide-react";
import { downloadBlob, makeReport } from "./report-export";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { money, type Operation } from "./model";
import { useWorkspace } from "./store";
export { Button };
export function Badge({ status }: { status: string }) {
  const good = [
    "Released",
    "Paid",
    "Completed",
    "Delivered",
    "Approved",
    "Ready for dispatch",
    "Offloaded",
  ];
  const warn = ["At port", "Pending", "Part-paid", "Assigned", "In clearance"];
  const bad = ["Delayed", "On hold", "Rejected", "Cancelled", "Overdue"];
  return (
    <span
      className={`status ${good.includes(status) ? "status-good" : bad.includes(status) ? "status-bad" : warn.includes(status) ? "status-warn" : "status-info"}`}
    >
      <i />
      {status}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({ text = "No records match your filters." }: { text?: string }) {
  return (
    <div className="empty-state">
      <Search size={26} />
      <h3>No records found</h3>
      <p>{text}</p>
    </div>
  );
}
export function OperationTable({
  rows,
  compact = false,
}: {
  rows: Operation[];
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Operation / customer</th>
            <th>Route</th>
            <th>Freight</th>
            <th>Status</th>
            {!compact && <th>Customer charge</th>}
            <th>Progress</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((op) => (
            <tr key={op.id}>
              <td>
                <Link
                  className="record-link"
                  to="/operations/$operationId"
                  params={{ operationId: op.id }}
                >
                  {op.id}
                </Link>
                <span className="cell-sub">{op.customer}</span>
              </td>
              <td>
                <span>{op.origin.split(",")[0]}</span>
                <span className="cell-sub">↳ {op.destination}</span>
              </td>
              <td>
                {op.type}
                <span className="cell-sub">
                  {op.quantity} units · {op.weight / 1000}t
                </span>
              </td>
              <td>
                <Badge status={op.status} />
              </td>
              {!compact && (
                <td className="numeric">
                  {money(op.charge)}
                  <span className="cell-sub">ETB</span>
                </td>
              )}
              <td>
                <div className="progress-cell">
                  <progress max={100} value={op.progress} />
                  <span>{op.progress}%</span>
                </div>
              </td>
              <td>
                <Button asChild size="icon" variant="ghost" title={`Open ${op.id}`}>
                  <Link to="/operations/$operationId" params={{ operationId: op.id }}>
                    <ChevronRight />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <Empty />}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => onChange("")}>
          <X />
        </Button>
      )}
    </div>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="erp-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {description || "Rayz staff record"}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function FormModal({
  open,
  onClose,
  title,
  fields,
  onSubmit,
  submit = "Add record",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: {
    name: string;
    label: string;
    type?: string;
    value?: string;
    options?: string[];
    required?: boolean;
  }[];
  onSubmit: (data: Record<string, string>) => void | Promise<unknown>;
  submit?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<
      string,
      string
    >;
    try {
      setBusy(true);
      await onSubmit(data);
      setError("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this record.");
    } finally { setBusy(false); }
  }
  return (
    <Modal
      open={open}
      onClose={() => {
        setError("");
        onClose();
      }}
      title={title}
    >
      <form onSubmit={handle} className="record-form">
        <div className="form-grid">
          {fields.map((f) => (
            <Field key={f.name} label={f.label}>
              {f.options ? (
                <select
                  aria-label={f.label}
                  name={f.name}
                  required={f.required !== false}
                  defaultValue={f.value}
                >
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={f.label}
                  name={f.name}
                  type={f.type || "text"}
                  defaultValue={f.value}
                  required={f.required !== false}
                  step={f.type === "number" ? "any" : undefined}
                />
              )}
            </Field>
          ))}
        </div>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <div className="form-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <Plus />
            {busy ? "Saving…" : submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function OperationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const { operations } = useWorkspace();
  return (
    <select aria-label="Operation filter" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All operations</option>
      {operations.map((o) => (
        <option key={o.id} value={o.id}>
          {o.id} · {o.customer}
        </option>
      ))}
    </select>
  );
}
export function exportCsv(name: string, rows: Record<string, string | number>[]) {
  const headers = Object.keys(rows[0] || { Result: "No records" });
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\r\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}
export function ExportButton({
  name,
  rows,
  filters = "Current filtered records",
}: {
  name: string;
  rows: Record<string, string | number>[];
  filters?: string;
}) {
  const { company } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; filename: string } | null>(null);
  const [error, setError] = useState("");
  const signature = JSON.stringify(rows) + filters + name + company.company;
  const [preparedFor, setPreparedFor] = useState("");
  async function prepare(format: "pdf" | "xlsx") {
    setBusy(true); setError(""); setReady(null);
    try { const title = name.replace(/^rayz-/, "").replaceAll("-", " "); const blob = await makeReport(format, title, rows, filters, company.branding.display_name || company.name); setReady({ blob, filename: `${name}.${format}` }); setPreparedFor(signature); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not prepare export."); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Button variant="outline" onClick={() => exportCsv(name, rows)}><Download />CSV</Button>
      <Button disabled={busy} variant="outline" onClick={() => void prepare("pdf")}><FileText />PDF</Button>
      <Button disabled={busy} variant="outline" onClick={() => void prepare("xlsx")}><FileSpreadsheet />Excel</Button>
      {busy && <span role="status">Preparing…</span>}
      {ready && preparedFor === signature && <Button onClick={() => downloadBlob(ready.blob, ready.filename)}><Download />Download {ready.filename.endsWith(".pdf") ? "PDF" : "Excel"}</Button>}
      {error && <span role="alert" className="form-error">{error}</span>}
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  detail,
  positive = true,
  icon,
  href,
}: {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  positive?: boolean;
  icon: ReactNode;
  href: "/operations" | "/transport" | "/invoices" | "/finance" | "/logistics";
}) {
  return (
    <Link to={href} className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="stat-bottom">
        <span className={positive ? "positive" : "warning-text"}>{detail}</span>
        <ArrowUpRight size={15} />
      </div>
    </Link>
  );
}
