import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  ArrowLeft,
  Download,
  FileText,
  Clock,
  Upload,
  Package,
  Anchor,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useSessionField } from "./store";
import { CategoryTabs } from "./category-tabs";
import {
  canWrite,
  canView,
  costDepartment,
  money,
  financialSummary,
  dateLabel,
  type Operation,
  type Stage,
} from "./model";
import {
  PageHeader,
  SectionHeading,
  OperationTable,
  SearchInput,
  Badge,
  Button,
  Field,
  Modal,
  Empty,
  ExportButton,
} from "./ui";
import { CostTable, ChargeForm } from "./logistics";
import { TripTable } from "./transport";
import { FinancialMetrics, InvoiceTable } from "./finance";
import { WorkPanel } from "./approval-workspace";
import { DocumentPanel } from "./document-panel";
import { FreightPanel, LocalTaskPanel } from "./operational-panels";
import { duplicateContainersWithinOperation } from "./production-model";
export function Operations() {
  const { operations, role, customers } = useWorkspace();
  const [search, setSearch] = useSessionField("operations:search");
  const [status, setStatus] = useSessionField("operations:status");
  const [customer, setCustomer] = useSessionField("operations:customer");
  const [create, setCreate] = useState(false);
  const rows = operations.filter(
    (o) =>
      (!status || o.status === status) &&
      (!customer || o.customer === customer) &&
      [o.id, o.customer, ...o.containers].some((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE"
        title="Freight operations"
        description="One operation. Every port stage, trip, and financial record."
      >
        {canWrite(role, "operations") && (
          <Button onClick={() => setCreate(true)}>
            <Plus />
            Create operation
          </Button>
        )}
      </PageHeader>
      <section className="panel">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search operation, customer, container…"
          />
          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[...new Set(operations.map((o) => o.status))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Customer filter"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
          <span className="toolbar-count">{rows.length} operations</span>
          <ExportButton
            name="rayz-operations"
            rows={rows.map((o) => ({
              Operation: o.id,
              Customer: o.customer,
              Origin: o.origin,
              Destination: o.destination,
              Status: o.status,
              Charge_ETB: o.charge,
            }))}
          />
        </div>
        <OperationTable rows={rows} />
        <div className="table-footer">
          <span>{rows.length} operations</span>
          <span>Reporting currency: ETB</span>
        </div>
      </section>
      <CreateOperation open={create} onClose={() => setCreate(false)} />
    </>
  );
}
export function CreateOperation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const [ports, setPorts] = useState([""]);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const qty = Number(d.get("quantity")),
      weight = Number(d.get("weight")),
      charge = Number(d.get("charge"));
    if (!ports.length || ports.some((p) => !p.trim()) || qty <= 0 || weight <= 0 || charge < 0) {
      setError(
        "Add at least one named port stage, a positive quantity and weight, and a non-negative charge.",
      );
      return;
    }
    const id = `RZ-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8)}`;
    const op: Operation = {
      id,
      customer: String(d.get("customer")),
      origin: String(d.get("origin")),
      destination: String(d.get("destination")),
      type: String(d.get("type")),
      quantity: qty,
      weight,
      containers: String(d.get("containers") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      status: "Draft",
      opened: new Date().toISOString().slice(0, 10),
      due: String(d.get("due")),
      charge,
      progress: 0,
      ready: false,
      blocker: "Freight readiness not yet confirmed",
    };
    const stages: Stage[] = ports.map((port, i) => ({
      id: `${id}-ST-${i + 1}`,
      operationId: id,
      port,
      country: ws.ports.find((p) => p.name === port)?.country || "",
      status: "Pending",
      arrival: new Date().toISOString().slice(0, 10),
      release: String(d.get("due")),
      owner: ws.role,
    }));
    if (duplicateContainersWithinOperation(op.containers)) { setError('Container identifiers must be unique within this operation.'); return; }
    try { await ws.createOperation(op, stages); } catch (err) { setError(err instanceof Error ? err.message : "Could not save operation."); return; }
    onClose();
    toast.success("Operation saved permanently");
    navigate({ to: "/operations/$operationId", params: { operationId: id } });
  }
  return (
    <Modal open={open} onClose={onClose} title="Create freight operation">
      <form className="record-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Customer">
            <select name="customer" required>
              {ws.customers.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Freight type">
            <select name="type" required>
              {ws.configuration.filter((c) => c.category === "freight_type" && c.active).map((c) => c.name).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Origin">
            <input name="origin" required placeholder="Shanghai, China" />
          </Field>
          <Field label="Destination">
            <input name="destination" required placeholder="Addis Ababa" />
          </Field>
          <Field label="Quantity">
            <input name="quantity" type="number" min="1" defaultValue="1" required />
          </Field>
          <Field label="Gross weight (kg)">
            <input name="weight" type="number" min="1" required />
          </Field>
          <Field label="Customer charge (ETB)">
            <input name="charge" type="number" min="0" required />
          </Field>
          <Field label="Expected delivery">
            <input name="due" type="date"  required />
          </Field>
          <Field label="Container numbers (comma-separated, if applicable)">
            <input name="containers" />
          </Field>
        </div>
        <div className="section-heading px-0 mt-4">
          <h2>Port handling stages</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPorts((p) => [...p, ""])}
          >
            <Plus />
            Add port
          </Button>
        </div>
        <div className="space-y-3 mt-3">
          {ports.map((p, i) => (
            <div className="flex gap-2 items-center" key={i}>
              <span className="text-muted-foreground text-xs">{i + 1}.</span>
              <select
                aria-label={`Port stage ${i + 1}`}
                value={p}
                onChange={(e) => setPorts((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}
                required
                className="flex-1"
              ><option value="">Select configured port</option>{ws.ports.filter((port) => port.active).map((port) => <option key={port.name}>{port.name}</option>)}</select>
              {ports.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPorts((ps) => ps.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={ws.pending || !ws.customers.length || !ws.ports.length || !ws.configuration.some((c) => c.category === "freight_type" && c.active)}>
            <Plus />
            Create operation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function OperationDetail({ id }: { id: string }) {
  const ws = useWorkspace();
  const { setViewState } = ws;
  useEffect(() => {
    setViewState((state) => ({ ...state, "active-operation": id }));
  }, [id, setViewState]);
  const [savedTab, setTab] = useSessionField(`operation:${id}:tab`, "Overview");
  const allowedTabs = [
    "Overview",
    ...(canView(ws.role, "logistics") ? ws.actor.area === "external" ? ["External Logistics"] : ws.actor.area === "internal" ? ["Internal Logistics"] : ["External Logistics", "Internal Logistics"] : []),
    ...(canView(ws.role, "transport") ? ["Transport"] : []),
    ...(canView(ws.role, "finance") ? ["Finance"] : []),
    "Documents",
    "Activity",
  ];
  const tab = allowedTabs.includes(savedTab) ? savedTab : "Overview";
  const [logisticsCategory, setLogisticsCategory] = useSessionField(
    `operation:${id}:logistics-category`,
    "All bills",
  );
  const [charge, setCharge] = useState(false);
  const op = ws.operations.find((o) => o.id === id);
  if (!op)
    return <Empty text="This operation was not found or is outside your assigned work." />;
  const stages = ws.stages.filter((s) => s.operationId === id),
    trips = ws.trips.filter((t) => t.operationId === id),
    costs = ws.costs.filter((c) => c.operationId === id),
    invoices = ws.invoices.filter((i) => i.operationId === id);
  const summary = financialSummary(op, ws.costs, ws.trips, ws.invoices);
  return (
    <>
      <Link
        to="/operations"
        className="inline-flex gap-2 items-center text-muted-foreground text-xs mb-4"
      >
        <ArrowLeft size={13} />
        Freight operations
      </Link>
      <PageHeader title={op.id} description={`${op.customer} · ${op.origin} → ${op.destination}`}>
        <Badge status={op.status} />
        <Button variant="outline" onClick={() => window.print()}>
          <FileText />
          Print overview
        </Button>
      </PageHeader>
      <CategoryTabs labels={allowedTabs} value={tab} onChange={setTab} />
      {tab === "Overview" && <FreightPanel operation={id} />}
      {tab === "Internal Logistics" && <LocalTaskPanel operation={id} />}
      {tab === "Overview" && (
        <>
          <div className="detail-grid">
            <section className="panel">
              <SectionHeading title="Operation overview" />
              <div className="detail-body">
                <dl className="detail-fields">
                  {[
                    ["Customer", op.customer],
                    ["Expected delivery", dateLabel(op.due)],
                    ["Freight", `${op.quantity} × ${op.type}`],
                    ["Gross weight", `${money(op.weight)} kg`],
                    ["Origin", op.origin],
                    ["Destination", op.destination],
                    ["Handling stages", `${stages.length} independent port stages`],
                    ["Truck assignments", `${trips.length} trips`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className={`note ${op.blocker ? "warning-note" : ""}`}>
                  <strong>
                    {op.ready ? "Freight available for dispatch" : "Dispatch blocked"}
                  </strong>
                  <br />
                  {op.blocker ||
                    "Freight released. Trips can proceed while other operation activities continue."}
                </div>
                <SectionHeading title="Freight identification" />
                {op.containers.length ? (
                  op.containers.map((c) => (
                    <div className="flex justify-between py-3 border-b border-border" key={c}>
                      <span>{c}</span>
                      <Badge status={op.ready ? "Released" : "Pending"} />
                    </div>
                  ))
                ) : (
                  <p className="mt-3">
                    {op.type} · {op.quantity} units · no container identifier applicable
                  </p>
                )}
              </div>
            </section>
            <section className="panel">
              <SectionHeading title="Operation timeline" />
              <div className="timeline">
                <div className="timeline-item">
                  <strong>Operation opened</strong>
                  <p>
                    {dateLabel(op.opened)} · {op.customer}
                  </p>
                </div>
                {stages.map((s) => (
                  <div className="timeline-item" key={s.id}>
                    <strong>{s.port} handling</strong>
                    <p>
                      {dateLabel(s.arrival)} · {s.owner}
                    </p>
                    <div className="mt-2">
                      <Badge status={s.status} />
                    </div>
                  </div>
                ))}
                {trips.map((t) => (
                  <div className="timeline-item" key={t.id}>
                    <strong>
                      {t.id} · {t.truck}
                    </strong>
                    <p>
                      {dateLabel(t.departure)} · {t.ownership}
                    </p>
                    <div className="mt-2">
                      <Badge status={t.status} />
                    </div>
                  </div>
                ))}
                <div className="timeline-item">
                  <strong>Expected delivery</strong>
                  <p>
                    {dateLabel(op.due)} · {op.destination}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
      {tab === "External Logistics" && (
        <div className="screen-stack">
          <section className="panel">
            <SectionHeading title="Independent port handling stages">
              {canWrite(ws.role, "logistics") && (
                <Button onClick={() => setCharge(true)} size="sm">
                  <Plus />
                  Add charge
                </Button>
              )}
            </SectionHeading>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Port / country</th>
                    <th>Arrival</th>
                    <th>Release / expected</th>
                    <th>Responsible staff</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.port}
                        <span className="cell-sub">{s.country}</span>
                      </td>
                      <td>{dateLabel(s.arrival)}</td>
                      <td>{dateLabel(s.release)}</td>
                      <td>{s.owner}</td>
                      <td>
                        <Badge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <SectionHeading title="Logistics bills and expenses" />
            <CategoryTabs
              labels={["All bills", "Storage", "Demurrage", "Customs clearance", "Service charges"]}
              value={logisticsCategory}
              onChange={setLogisticsCategory}
            />
            <CostTable
              rows={costs.filter(
                (c) =>
                  costDepartment(c) === "external" &&
                  (logisticsCategory === "All bills" || c.category === logisticsCategory),
              )}
            />
          </section>
        </div>
      )}
      {tab === "Internal Logistics" && (
        <section className="panel">
          <SectionHeading title="Local clearance, government duties and charges">
            {canWrite(ws.role, "logistics") && (
              <Button onClick={() => setCharge(true)} size="sm">
                <Plus />
                Add local charge
              </Button>
            )}
          </SectionHeading>
          <CostTable rows={costs.filter((c) => costDepartment(c) === "internal")} />
        </section>
      )}
      {tab === "Transport" && (
        <section className="panel">
          <SectionHeading title="Operation trips">
            <Button asChild variant="outline" size="sm">
              <Link to="/transport">
                Open dispatch board
                <Truck />
              </Link>
            </Button>
          </SectionHeading>
          <TripTable rows={trips} />
        </section>
      )}
      {tab === "Finance" && !["Dispatcher", "Logistics Officer"].includes(ws.role) && (
        <>
          <FinancialMetrics summary={summary} />
          <p className="note">
            Estimated profit = customer charges minus approved actual costs. Excludes pending costs,
            taxes, FX revaluation and overhead.
          </p>
          <section className="panel">
            <SectionHeading title="Customer invoices" />
            <InvoiceTable rows={invoices} />
          </section>
          <section className="panel mt-5">
            <SectionHeading title="Operation costs" />
            <CostTable rows={costs} />
          </section>
        </>
      )}
      {tab === "Documents" && <DocumentPanel operation={id} />}
      {tab === "Activity" && (
        <section className="panel">
          <SectionHeading
            title="Audit and activity history"
            description="Permanent assignments, decisions and transaction history"
          />
          {ws.activity
            .filter((a) => a.operationId === id)
            .map((a) => (
              <div className="audit-item" key={a.id}>
                <Clock size={18} />
                <div>
                  <strong>{a.text}</strong>
                  <p>
                    {a.actor} · {a.time}
                  </p>
                </div>
              </div>
            ))}
          {!ws.activity.some((a) => a.operationId === id) && (
            <Empty text="No activity recorded for this operation yet." />
          )}
        </section>
      )}
      {ws.actor.department && <WorkPanel department={ws.actor.department} {...(tab === "External Logistics" ? { initialArea: "external" as const } : tab === "Internal Logistics" ? { initialArea: "internal" as const } : {})} />}
      <ChargeForm
        open={charge}
        onClose={() => setCharge(false)}
        operationId={id}
        local={tab === "Internal Logistics"}
      />
    </>
  );
}
