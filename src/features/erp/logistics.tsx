import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Check, FileText, X, Anchor } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useSessionField } from "./store";
import { CategoryTabs } from "./category-tabs";
import { navigation } from "./navigation";
import { DepartmentDocuments } from "./category-workspace";
import {
  canWrite,
  canApprove,
  costDepartment,
  convertedCost,
  money,
  dateLabel,
  type Cost,
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
} from "./ui";
import { WorkPanel } from "./approval-workspace";
import { MilestoneControls } from "./operational-panels";
import { convertNewCost } from "./production-model";
export function CostTable({ rows }: { rows: Cost[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Bill / category</th>
            <th>Supplier / operation</th>
            <th>Original amount</th>
            <th>ETB exchange rate</th>
            <th>Converted cost</th>
            <th>Approval</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.id}</strong>
                <span className="cell-sub">{c.category}</span>
              </td>
              <td>
                {c.supplier}
                <Link
                  className="cell-sub"
                  to="/operations/$operationId"
                  params={{ operationId: c.operationId }}
                >
                  {c.operationId}
                </Link>
              </td>
              <td>
                {money(c.amount)} {c.currency}
              </td>
              <td>
                {c.rate.toFixed(2)}
                <span className="cell-sub">Snapshot · {dateLabel(c.date)}</span>
              </td>
              <td className="numeric">{money(convertedCost(c))} ETB</td>
              <td>
                <Badge status={c.approval} />
              </td>
              <td>
                <Badge status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
export function ChargeForm({
  open,
  onClose,
  operationId = "",
  local = false,
}: {
  open: boolean;
  onClose: () => void;
  operationId?: string;
  local?: boolean;
}) {
  const ws = useWorkspace();
  const ids = operationId ? [operationId] : ws.operations.map((o) => o.id);
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={local ? "Add local service / other expense" : "Add port handling charge"}
      fields={[
        { name: "operation", label: "Freight operation", options: ids },
        {
          name: "stage",
          label: "Port stage (must belong to operation)",
          options: local
            ? ["Local service"]
            : ws.stages
                .filter((s) => !operationId || s.operationId === operationId)
                .map((s) => `${s.id} · ${s.port}`),
        },
        {
          name: "category",
          label: local ? "Service name (configurable)" : "Charge category",
          ...(local
            ? {}
            : {
                options: [
                  "Storage",
                  "Demurrage",
                  "Customs clearance",
                  "Service charges",
                  "Port handling",
                ],
              }),
        },
        { name: "supplier", label: "Supplier / service provider" },
        { name: "amount", label: "Original amount", type: "number" },
        { name: "currency", label: "Currency", options: ["ETB", "USD", "CNY", "EUR"] },
        { name: "rate", label: "Historical rate to ETB", type: "number", value: "1" },
        { name: "rateSource", label: "Exchange-rate source / reference", required: false },
        { name: "date", label: "Bill / exchange rate date", type: "date", value: new Date().toISOString().slice(0, 10) },
      ]}
      onSubmit={async (d) => {
        if (!canWrite(ws.role, "logistics") && !canWrite(ws.role, "finance"))
          throw new Error("Your staff role cannot add charges.");
        const stageId = (d["stage"] || "").split(" · ")[0] || "";
        if (!local && !ws.stages.some((s) => s.id === stageId && s.operationId === d["operation"]))
          throw new Error("Select a port stage belonging to this operation.");
        const amount = Number(d["amount"]),
          rate = Number(d["rate"]);
        if (amount <= 0 || rate <= 0 || (d["currency"] === "ETB" && rate !== 1))
          throw new Error("Use positive amounts and rates. ETB exchange rate must be 1.");
        const op = d["operation"] || "";
        const id = `BL-${Date.now().toString().slice(-6)}`;
        const area = ws.actor.area === "finance" || ws.actor.department === "finance" ? "finance" : local ? "internal" : "external";
        if (d['currency'] !== 'ETB' && !d['rateSource']?.trim()) throw new Error('Record the historical exchange-rate source.');
        await ws.createWork(area, "Bill", op, `${d["category"]} · ${d["supplier"]}`, convertNewCost(amount, rate, d['currency'] || 'ETB'), { ...d, stageId: local ? "" : stageId, sourceId: id }, `Original ${amount} ${d["currency"]} × historical rate ${rate}`);
        toast.success("Bill saved as Draft; submit from assigned work");
      }}
    />
  );
}
export function Logistics() {
  const ws = useWorkspace();
  const [q, setQ] = useSessionField("external-logistics:search");
  const [op, setOp] = useSessionField("active-operation");
  const [status, setStatus] = useSessionField("external-logistics:status");
  const [tab, setTab] = useSessionField("external-logistics:tab", "Port Stages");
  const [port, setPort] = useSessionField("external-logistics:stage");
  const labels = navigation.find((s) => s.key === "external-logistics")?.tabs || [];
  const [selected, setSelected] = useState(""),
    [charge, setCharge] = useState(false),
    [local, setLocal] = useState(false),
    [addStage, setAddStage] = useState(false);
  const rows = ws.stages.filter(
    (s) =>
      (!op || s.operationId === op) &&
      (!status || s.status === status) &&
      [s.port, s.operationId, s.owner].some((x) => x.toLowerCase().includes(q.toLowerCase())),
  );
  const stage = ws.stages.find((s) => s.id === selected);
  const bills = ws.costs.filter(
    (c) =>
      costDepartment(c) === "external" &&
      (!op || c.operationId === op) &&
      (!port || c.stageId === port) &&
      [c.id, c.category, c.supplier, c.operationId].some((v) =>
        v.toLowerCase().includes(q.toLowerCase()),
      ),
  );
  const billsFor = (label: string) =>
    bills.filter(
      (c) =>
        label === "Port Stages" ||
        (label === "Port Customs Clearance"
          ? c.category === "Customs clearance"
          : label === "Service Charges"
            ? ["Service charges", "Port handling"].includes(c.category)
            : c.category === label),
    );
  return (
    <>
      <PageHeader
        eyebrow="LOGISTICS"
        title="External Logistics"
        description="Independent port stages, freight readiness, and auditable charges."
      >
        {canWrite(ws.role, "logistics") && (
          <>
            {ws.actor.area !== "external" && <Button
              variant="outline"
              onClick={() => {
                setLocal(true);
                setCharge(true);
              }}
            >
              <Plus />
              Local service
            </Button>}
            <Button
              onClick={() => {
                setLocal(false);
                setCharge(true);
              }}
            >
              <Plus />
              Add charge
            </Button>
          </>
        )}
      </PageHeader>
      <CategoryTabs
        labels={labels}
        value={tab}
        onChange={setTab}
        counts={Object.fromEntries(
          labels.map((label) => [
            label,
            label === "Port Stages"
              ? rows.length
              : label === "Documents"
                ? ws.documents.filter(
                    (d) =>
                      (!op || d.operationId === op) &&
                      !/internal|local|government/i.test(d.category),
                  ).length
                : billsFor(label).length,
          ]),
        )}
      />
      <section className="panel">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search port, operation, staff…" />
          <OperationSelect value={op} onChange={setOp} />
          <select
            aria-label="Port stage filter"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          >
            <option value="">All port stages</option>
            {ws.stages
              .filter((s) => !op || s.operationId === op)
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {s.port} · {s.id}
                </option>
              ))}
          </select>
          <select
            aria-label="Stage status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All stage statuses</option>
            {["Pending", "Released", "Delayed", "In clearance", "On hold"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {canWrite(ws.role, "logistics") && (
            <Button variant="outline" size="sm" onClick={() => setAddStage(true)}>
              <Plus />
              Add stage
            </Button>
          )}
        </div>
        {tab === "Port Stages" && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Port / country</th>
                  <th>Freight operation</th>
                  <th>Arrival</th>
                  <th>Release / expected</th>
                  <th>Responsible staff</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((s) => !port || s.id === port)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.port}</strong>
                        <span className="cell-sub">
                          {s.country} · {s.id}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="record-link"
                          to="/operations/$operationId"
                          params={{ operationId: s.operationId }}
                        >
                          {s.operationId}
                        </Link>
                        <span className="cell-sub">
                          {ws.operations.find((o) => o.id === s.operationId)?.customer}
                        </span>
                      </td>
                      <td>{dateLabel(s.arrival)}</td>
                      <td>{dateLabel(s.release)}</td>
                      <td>{s.owner}</td>
                      <td>
                        <Badge status={s.status} />
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(s.id)}>
                          View stage
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!rows.length && <Empty />}
          </div>
        )}
        {tab !== "Port Stages" && tab !== "Documents" && <CostTable rows={billsFor(tab)} />}
      </section>
      {tab === "Documents" && (
        <div className="mt-5">
          <DepartmentDocuments operation={op} department="external" />
        </div>
      )}
      {tab === "Port Stages" && (
        <section className="panel mt-5">
          <SectionHeading
            title="Logistics bills & local services"
            description="Original currencies and historical conversion rates are preserved."
          />
          <CostTable rows={bills} />
        </section>
      )}
      <ChargeForm open={charge} onClose={() => setCharge(false)} operationId={op} local={local} />
      <FormModal
        open={addStage}
        onClose={() => setAddStage(false)}
        title="Add independent port stage"
        fields={[
          {
            name: "operation",
            label: "Freight operation",
            options: ws.operations.map((o) => o.id),
          },
          { name: "port", label: "Port name", options: ws.ports.filter((p) => p.active).map((p) => p.name) },
          { name: "arrival", label: "Expected arrival", type: "date", value: new Date().toISOString().slice(0, 10) },
          { name: "release", label: "Expected release", type: "date", value: "" },
          
        ]}
        onSubmit={async (d) => {
          const id = `ST-${Date.now()}`;
          await ws.createWork("external", "Port stage", d["operation"] || "", d["port"] || "", 0, d, `Port: ${d["port"]}, country: ${d["country"]}, arrival: ${d["arrival"]}, release: ${d["release"]}`);
          toast.success("Port stage saved as Draft; submit from assigned work");
        }}
      />
      <Modal
        open={!!stage}
        onClose={() => setSelected("")}
        title={stage ? `${stage.port} · ${stage.id}` : "Port stage"}
      >
        {stage && (
          <>
            <div className="detail-fields">
              <div>
                <p>Operation</p>
                <strong>{stage.operationId}</strong>
              </div>
              <div>
                <p>Responsible staff</p>
                <strong>{stage.owner}</strong>
              </div>
              <div>
                <p>Arrival</p>
                <strong>{dateLabel(stage.arrival)}</strong>
              </div>
              <div>
                <p>Release / expected</p>
                <strong>{dateLabel(stage.release)}</strong>
              </div>
            </div>
            <Badge status={stage.status} />
            <MilestoneControls id={stage.id} kind="stageStatus" status={stage.status} />
            {ws.actor.manager && <label className="form-field">Assigned officer<select aria-label="Stage assigned officer" defaultValue="" onChange={async (e) => { try { await ws.operationalAction({ action: "assignStage", id: stage.id, assignedTo: e.target.value }); toast.success("Stage assigned"); } catch (error) { toast.error(error instanceof Error ? error.message : "Assignment failed"); } }}><option value="">Select assigned officer</option>{ws.assignments.filter((a) => a.operation_id === stage.operationId && a.area === "external").map((a) => <option key={a.user_id} value={a.user_id}>{ws.staff.find((s) => s.id === a.user_id)?.display_name || a.user_id}</option>)}</select></label>}
            <CostTable rows={ws.costs.filter((c) => c.stageId === stage.id)} />
            <Button variant="outline" onClick={() => window.print()}>
              <FileText />
              Print stage
            </Button>
            {canWrite(ws.role, "logistics") && <Button variant="outline" onClick={async () => { try { await ws.createWork("external", "Correction", stage.operationId, `Correction to ${stage.id}`, 0, { sourceId: stage.id }, "Review proposed port-stage correction"); toast.success("Correction draft created in assigned work"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save draft"); } }}>Request correction</Button>}
          </>
        )}
      </Modal>
    </>
  );
}
export function Approvals({ scope = "finance" }: { scope?: "finance" | "logistics" | "transport" }) {
  return <WorkPanel department={scope} queue />;
}
