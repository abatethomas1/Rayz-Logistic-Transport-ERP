import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Receipt, FileText, Wallet, ArrowUpRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useSessionField } from "./store";
import { CategoryTabs } from "./category-tabs";
import { navigation } from "./navigation";
import {
  canWrite,
  money,
  financialSummary,
  dateLabel,
  allocatePayment,
  settleTrip,
  ageDays,
  type Invoice,
  invoiceMatches,
  payableMatches,
} from "./model";
import {
  PageHeader,
  SectionHeading,
  SearchInput,
  OperationSelect,
  Badge,
  Button,
  FormModal,
  Modal,
  Empty,
  ExportButton,
} from "./ui";
import { CostTable, ChargeForm } from "./logistics";
import { PermissionGate } from "./shell";
import { CashWorkspace } from "./cash-workspace";
export function FinancialMetrics({ summary }: { summary: ReturnType<typeof financialSummary> }) {
  return (
    <div className="money-grid">
      {[
        ["Customer charges", summary.revenue],
        ["Invoiced amount", summary.invoiced],
        ["Payments received", summary.received],
        ["Approved actual costs", summary.costs],
        ["Outstanding payables", summary.payables],
        ["Estimated profit", summary.profit],
      ].map(([label, value]) => (
        <div className={`money-metric ${label === "Estimated profit" ? "profit" : ""}`} key={label}>
          <span>{label}</span>
          <strong>
            {money(Number(value))}
            <small>ETB</small>
          </strong>
        </div>
      ))}
    </div>
  );
}
export function Finance() {
  const ws = useWorkspace();
  const [op, setOp] = useSessionField("active-operation");
  const [charge, setCharge] = useState(false),
    [invoice, setInvoice] = useState(false);
  const summaries = ws.operations
    .filter((o) => !op || o.id === op)
    .map((o) => financialSummary(o, ws.costs, ws.trips, ws.invoices));
  const summary = summaries.reduce(
    (a, s) => ({
      revenue: a.revenue + s.revenue,
      costs: a.costs + s.costs,
      pending: a.pending + s.pending,
      profit: a.profit + s.profit,
      invoiced: a.invoiced + s.invoiced,
      received: a.received + s.received,
      payables: a.payables + s.payables,
    }),
    { revenue: 0, costs: 0, pending: 0, profit: 0, invoiced: 0, received: 0, payables: 0 },
  );
  return (
    <PermissionGate area="finance">
      <PageHeader
        eyebrow="FINANCE"
        title="Financial overview"
        description="Keep customer revenue separate from the actual cost of moving freight."
      >
        {canWrite(ws.role, "finance") && (
          <>
            <Button variant="outline" onClick={() => setCharge(true)}>
              <Plus />
              Other expense
            </Button>
            <Button onClick={() => setInvoice(true)}>
              <Plus />
              Create invoice
            </Button>
          </>
        )}
      </PageHeader>
      <div className="toolbar px-0">
        <OperationSelect value={op} onChange={setOp} />
        <Button asChild variant="outline">
          <Link to="/invoices">
            Receivables
            <ArrowUpRight />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/payables">
            Payables
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
      <FinancialMetrics summary={summary} />
      <CashWorkspace operation={op} />
      <div className="note">
        Estimated profit = customer charges − approved actual costs. Pending costs: ETB{" "}
        {money(summary.pending)} (excluded). Taxes, FX revaluation and overhead are not included.
      </div>
      <section className="panel">
        <SectionHeading
          title="Bills & other expenses"
          description="Historical currency conversions remain fixed for these transactions."
        />
        <CostTable rows={ws.costs.filter((c) => !op || c.operationId === op)} />
      </section>
      <section className="panel mt-5">
        <SectionHeading title="Operation financial summaries" />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Operation / customer</th>
                <th>Customer charges</th>
                <th>Approved costs</th>
                <th>Receipts</th>
                <th>Estimated profit</th>
              </tr>
            </thead>
            <tbody>
              {ws.operations
                .filter((o) => !op || o.id === op)
                .map((o) => {
                  const s = financialSummary(o, ws.costs, ws.trips, ws.invoices);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link
                          className="record-link"
                          to="/operations/$operationId"
                          params={{ operationId: o.id }}
                        >
                          {o.id}
                        </Link>
                        <span className="cell-sub">{o.customer}</span>
                      </td>
                      <td>{money(s.revenue)} ETB</td>
                      <td>{money(s.costs)} ETB</td>
                      <td>{money(s.received)} ETB</td>
                      <td className="positive">{money(s.profit)} ETB</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      <ChargeForm open={charge} onClose={() => setCharge(false)} operationId={op} local />
      <CreateInvoice open={invoice} onClose={() => setInvoice(false)} />
    </PermissionGate>
  );
}
export function InvoiceTable({ rows }: { rows: Invoice[] }) {
  const ws = useWorkspace();
  const [selected, setSelected] = useState(""),
    [payment, setPayment] = useState("");
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Invoice / customer</th>
              <th>Operation</th>
              <th>Invoiced</th>
              <th>Received</th>
              <th>Balance</th>
              <th>Due / aging</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong className="record-link">{i.id}</strong>
                  <span className="cell-sub">
                    {ws.operations.find((o) => o.id === i.operationId)?.customer}
                  </span>
                </td>
                <td>
                  <Link to="/operations/$operationId" params={{ operationId: i.operationId }}>
                    {i.operationId}
                  </Link>
                </td>
                <td>{money(i.amount)} ETB</td>
                <td>{money(i.paid)} ETB</td>
                <td>{money(i.amount - i.paid)} ETB</td>
                <td>
                  {dateLabel(i.due)}
                  <span
                    className={`cell-sub ${ageDays(i.due) && i.status !== "Paid" ? "warning-text" : ""}`}
                  >
                    {i.status === "Paid"
                      ? "Settled"
                      : ageDays(i.due)
                        ? `${ageDays(i.due)} days overdue`
                        : "Current"}
                  </span>
                </td>
                <td>
                  <Badge status={i.status} />
                </td>
                <td>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(i.id)}>
                    Preview
                  </Button>
                  {canWrite(ws.role, "finance") && i.paid < i.amount && ["Issued", "Part-paid"].includes(i.status) && (
                    <Button size="sm" variant="outline" onClick={() => setPayment(i.id)}>
                      Payment
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
      <InvoicePreview id={selected} onClose={() => setSelected("")} />
      <PaymentForm id={payment} onClose={() => setPayment("")} />
    </>
  );
}
export function Invoices() {
  const ws = useWorkspace();
  const [q, setQ] = useSessionField("invoices:search");
  const [status, setStatus] = useSessionField("invoices:status");
  const [aging, setAging] = useSessionField("invoices:aging");
  const [op, setOp] = useSessionField("active-operation");
  const [tab, setTab] = useSessionField("invoices:tab", "All");
  const [create, setCreate] = useState(false);
  const labels = navigation.find((s) => s.key === "customer-invoices")?.tabs || [];
  const baseRows = ws.invoices.filter(
    (i) =>
      (!op || i.operationId === op) &&
      (!status || i.status === status) &&
      (!aging ||
        (aging === "Overdue"
          ? ageDays(i.due) > 0 && i.paid < i.amount
          : ageDays(i.due) === 0 && i.paid < i.amount)) &&
      [i.id, i.operationId, ws.operations.find((o) => o.id === i.operationId)?.customer || ""].some(
        (v) => v.toLowerCase().includes(q.toLowerCase()),
      ),
  );
  const rows = baseRows.filter((i) => invoiceMatches(i, tab));
  return (
    <PermissionGate area="finance">
      <PageHeader
        eyebrow="FINANCE"
        title="Customer invoices & receivables"
        description="Invoice previews, partial receipts, and outstanding balances."
      >
        {canWrite(ws.role, "finance") && (
          <Button onClick={() => setCreate(true)}>
            <Plus />
            Create invoice
          </Button>
        )}
      </PageHeader>
      <CategoryTabs
        labels={labels}
        value={tab}
        onChange={setTab}
        counts={Object.fromEntries(
          labels.map((label) => [label, baseRows.filter((i) => invoiceMatches(i, label)).length]),
        )}
      />
      <div className="money-grid">
        <div className="money-metric">
          <span>Total invoiced</span>
          <strong>
            {money(ws.invoices.reduce((s, i) => s + i.amount, 0))}
            <small>ETB</small>
          </strong>
        </div>
        <div className="money-metric">
          <span>Outstanding</span>
          <strong>
            {money(ws.invoices.reduce((s, i) => s + i.amount - i.paid, 0))}
            <small>ETB</small>
          </strong>
        </div>
        <div className="money-metric">
          <span>Overdue receivables</span>
          <strong>
            {money(
              ws.invoices
                .filter((i) => ageDays(i.due) > 0)
                .reduce((s, i) => s + i.amount - i.paid, 0),
            )}
            <small>ETB</small>
          </strong>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search invoice or customer…" />
          <OperationSelect value={op} onChange={setOp} />
          <select
            aria-label="Invoice status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["Draft", "Issued", "Part-paid", "Paid"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Receivable aging"
            value={aging}
            onChange={(e) => setAging(e.target.value)}
          >
            <option value="">All aging</option>
            <option>Current</option>
            <option>Overdue</option>
          </select>
          <ExportButton
            name="rayz-receivables"
            rows={rows.map((i) => ({
              Invoice: i.id,
              Operation: i.operationId,
              Amount_ETB: i.amount,
              Received_ETB: i.paid,
              Balance_ETB: i.amount - i.paid,
              Due: i.due,
              Aging_days: ageDays(i.due),
            }))}
          />
        </div>
        <InvoiceTable rows={rows} />
      </section>
      <CreateInvoice open={create} onClose={() => setCreate(false)} />
    </PermissionGate>
  );
}
function CreateInvoice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useWorkspace();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Create draft customer invoice"
      submit="Create draft"
      fields={[
        { name: "operation", label: "Freight operation", options: ws.operations.map((o) => o.id) },
        { name: "amount", label: "Invoice amount (ETB)", type: "number" },
        { name: "due", label: "Due date", type: "date", value: "" },
      ]}
      onSubmit={async (d) => {
        const amount = Number(d["amount"]);
        if (amount <= 0) throw new Error("Invoice amount must be positive.");
        const op = ws.operations.find((o) => o.id === d["operation"]);
        if (!op) throw new Error("Select a freight operation.");
        const billed = ws.invoices
          .filter((i) => i.operationId === op.id)
          .reduce((s, i) => s + i.amount, 0);
        if (amount > op.charge - billed)
          throw new Error(
            `Remaining customer charges available to invoice: ETB ${money(op.charge - billed)}.`,
          );
        const id = `INV-2026-${82 + ws.invoices.length - 4}`;
        await ws.createWork("finance", "Invoice", op.id, `Customer invoice · ${op.customer}`, amount, { ...d, sourceId: id });
        toast.success("Invoice Draft saved; approval is required before issue");
      }}
    />
  );
}
function PaymentForm({ id, onClose }: { id: string; onClose: () => void }) {
  const ws = useWorkspace();
  const invoice = ws.invoices.find((i) => i.id === id);
  return (
    <FormModal
      open={!!invoice}
      onClose={onClose}
      title={`Record payment · ${id}`}
      submit="Save payment draft"
      fields={[
        {
          name: "amount",
          label: `Payment amount (ETB) · balance ${money(invoice ? invoice.amount - invoice.paid : 0)}`,
          type: "number",
        },
        { name: "reference", label: "Bank / receipt reference" },
        { name: "date", label: "Receipt date", type: "date", value: new Date().toISOString().slice(0, 10) },
      ]}
      onSubmit={async (d) => {
        if (!invoice) return;
        allocatePayment(invoice, Number(d["amount"]));
        await ws.createWork("finance", "Payment", invoice.operationId, `Payment · ${d["reference"]}`, Number(d["amount"]), { ...d, sourceId: id });
        toast.success("Payment Draft saved; approve before posting");
      }}
    />
  );
}
function InvoicePreview({ id, onClose }: { id: string; onClose: () => void }) {
  const ws = useWorkspace();
  const inv = ws.invoices.find((i) => i.id === id);
  const [issue, setIssue] = useState(false);
  const op = ws.operations.find((o) => o.id === inv?.operationId);
  return (
    <Modal open={!!inv} onClose={onClose} title="Customer invoice preview">
      {inv && (
        <>
          <div className="invoice-preview">
            <div className="invoice-brand">
              <div>
                <h2>RAYZ</h2>
                <p>
                  Logistic and Transport
                  <br />
                  Addis Ababa, Ethiopia
                </p>
              </div>
              <div>
                <h2>{inv.id}</h2>
                <p>
                  {dateLabel(inv.issued)}
                  <br />
                  Due {dateLabel(inv.due)}
                </p>
              </div>
            </div>
            <p>Bill to</p>
            <h3>{op?.customer}</h3>
            <p className="mt-2">Freight operation {inv.operationId}</p>
            <div className="invoice-total">
              <span>Freight and logistics services</span>
              <span>{money(inv.amount)} ETB</span>
            </div>
            <div className="flex justify-between mt-4">
              <span>Payments received</span>
              <span>{money(inv.paid)} ETB</span>
            </div>
            <div className="flex justify-between mt-4 font-bold">
              <span>Balance due</span>
              <span>{money(inv.amount - inv.paid)} ETB</span>
            </div>
            <p className="mt-6">
              No tax applies.
            </p>
          </div>
          <Badge status={inv.status} />
          <div className="form-footer">
            <Button variant="outline" onClick={() => window.print()}>
              <FileText />
              Print / Save PDF
            </Button>
          </div>

        </>
      )}
    </Modal>
  );
}
export function Payables() {
  const ws = useWorkspace();
  const [settle, setSettle] = useState("");
  const [q, setQ] = useSessionField("payables:search");
  const [aging, setAging] = useSessionField("payables:aging");
  const [op, setOp] = useSessionField("active-operation");
  const [tab, setTab] = useSessionField("payables:tab", "All");
  const labels = navigation.find((s) => s.key === "subcontractor-payables")?.tabs || [];
  const baseRows = ws.trips.filter(
    (t) =>
      (!op || t.operationId === op) &&
      t.ownership === "Subcontractor" &&
      t.status !== "Cancelled" &&
      [t.supplier, t.id, t.operationId].some((v) => v.toLowerCase().includes(q.toLowerCase())) &&
      (!aging || (aging === "Settled" ? t.paid === t.cost : t.paid < t.cost)),
  );
  const rows = baseRows.filter((t) => payableMatches(t, tab));
  const trip = ws.trips.find((t) => t.id === settle);
  return (
    <PermissionGate area="finance">
      <PageHeader
        eyebrow="FINANCE"
        title="Subcontractor payables"
        description="Track obligations and allocate partial or full settlements."
      />
      <CategoryTabs
        labels={labels}
        value={tab}
        onChange={setTab}
        counts={Object.fromEntries(
          labels.map((label) => [label, baseRows.filter((t) => payableMatches(t, label)).length]),
        )}
      />
      {tab === "Approved" && (
        <p className="note">No payable approval records have been recorded in this prototype.</p>
      )}
      <section className="panel">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search subcontractor or trip…" />
          <OperationSelect value={op} onChange={setOp} />
          <select
            aria-label="Payable status"
            value={aging}
            onChange={(e) => setAging(e.target.value)}
          >
            <option value="">All obligations</option>
            <option>Outstanding</option>
            <option>Settled</option>
          </select>
          <ExportButton
            name="rayz-subcontractor-payables"
            rows={rows.map((t) => ({
              Supplier: t.supplier,
              Trip: t.id,
              Cost_ETB: t.cost,
              Settled_ETB: t.paid,
              Balance_ETB: t.cost - t.paid,
            }))}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subcontractor</th>
                <th>Trip / operation</th>
                <th>Actual cost</th>
                <th>Settled</th>
                <th>Balance</th>
                <th>Due / aging</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.supplier}</td>
                  <td>
                    {t.id}
                    <Link
                      className="cell-sub"
                      to="/operations/$operationId"
                      params={{ operationId: t.operationId }}
                    >
                      {t.operationId}
                    </Link>
                  </td>
                  <td>{money(t.cost)} ETB</td>
                  <td>{money(t.paid)} ETB</td>
                  <td>{money(t.cost - t.paid)} ETB</td>
                  <td>
                    —<span className="cell-sub">Terms not recorded</span>
                  </td>
                  <td>
                    <Badge status={t.paid === t.cost ? "Paid" : t.paid ? "Part-paid" : "Unpaid"} />
                  </td>
                  <td>
                    {canWrite(ws.role, "finance") && t.paid < t.cost && (
                      <Button size="sm" variant="outline" onClick={() => setSettle(t.id)}>
                        Settle
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty />}
        </div>
      </section>
      <div className="note">
        Supplier due dates and withholding policies require company confirmation.
      </div>
      <FormModal
        open={!!trip}
        onClose={() => setSettle("")}
        title={`Record settlement · ${trip?.supplier || ""}`}
        submit="Save settlement draft"
        fields={[
          {
            name: "amount",
            label: `Amount (ETB) · balance ${money(trip ? trip.cost - trip.paid : 0)}`,
            type: "number",
          },
          { name: "reference", label: "Payment reference" },
          { name: "date", label: "Settlement date", type: "date", value: new Date().toISOString().slice(0, 10) },
        ]}
        onSubmit={async (d) => {
          if (!trip) return;
          settleTrip(trip, Number(d["amount"]));
          await ws.createWork("finance", "Settlement", trip.operationId, `Settlement · ${d["reference"]}`, Number(d["amount"]), { ...d, sourceId: trip.id });
          toast.success("Settlement Draft saved; approval is required before posting");
        }}
      />
    </PermissionGate>
  );
}
export function Rates() {
  const ws = useWorkspace();
  const [type, setType] = useState("");
  const [add, setAdd] = useState(false);
  const rates = ws.rates;
  return (
    <PermissionGate area="finance">
      <PageHeader
        eyebrow="FINANCE"
        title="Truck rate cards"
        description="Separate fleet and subcontractor rates with effective dates."
      >
        {canWrite(ws.role, "finance") && (
          <Button onClick={() => setAdd(true)}>
            <Plus />
            Add rate card
          </Button>
        )}
      </PageHeader>
      <section className="panel">
        <div className="toolbar">
          <select
            aria-label="Rate card ownership"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All rate cards</option>
            <option>Company</option>
            <option>Subcontractor</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rate card</th>
                <th>Fleet type</th>
                <th>Lane</th>
                <th>Freight type</th>
                <th>Rate</th>
                <th>Effective from</th>
                <th>Effective to</th>
              </tr>
            </thead>
            <tbody>
              {rates
                .filter((r) => !type || r.type === type)
                .map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.type}</td>
                    <td>{r.lane}</td>
                    <td>{r.freight}</td>
                    <td>{money(r.amount)} ETB</td>
                    <td>{dateLabel(r.from)}</td>
                    <td>{dateLabel(r.to)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="note">
        Existing trip costs retain their original snapshot. Adding a rate does not retroactively
        alter historical trips.
      </p>
      <FormModal
        open={add}
        onClose={() => setAdd(false)}
        title="Add rate card"
        fields={[
          { name: "type", label: "Fleet type", options: ["Company", "Subcontractor"] },
          { name: "lane", label: "Lane (origin → destination)" },
          { name: "freight", label: "Freight type" },
          { name: "amount", label: "Rate (ETB)", type: "number" },
          { name: "from", label: "Effective from", type: "date", value: new Date().toISOString().slice(0, 10) },
          { name: "to", label: "Effective to", type: "date", value: "" },
        ]}
        onSubmit={async (d) => {
          if (Number(d["amount"]) <= 0 || (d["from"] || "") > (d["to"] || ""))
            throw new Error("Use a positive rate and a valid effective date range.");
          const op = ws.operations[0];
          if (!op) throw new Error("No assigned operation available.");
          await ws.createWork("finance", "Rate card", op.id, d["lane"] || "Rate card", Number(d["amount"]), d);
          toast.success("Rate card Draft saved for Finance Manager review");
        }}
      />
    </PermissionGate>
  );
}
