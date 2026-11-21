import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Plus, Upload } from "lucide-react";
import { useSessionField, useWorkspace } from "./store";
import { navigation, visibleSection } from "./navigation";
import { CategoryTabs } from "./category-tabs";
import { DocumentPanel } from "./document-panel";
import { FreightPanel, LocalTaskPanel, TruckRequestPanel } from "./operational-panels";
import { AuthorizedReportPanel } from "./report-panel";
import { CashWorkspace } from "./cash-workspace";
import {
  PageHeader,
  SectionHeading,
  SearchInput,
  OperationSelect,
  OperationTable,
  Button,
  Empty,
  ExportButton,
} from "./ui";
import { CostTable, ChargeForm, Approvals } from "./logistics";
import { InvoiceTable } from "./finance";
import { AssignmentForm, TripTable } from "./transport";
import {
  canWrite,
  costDepartment,
  convertedCost,
  freightMatches,
  financialSummary,
  ageDays,
  money,
} from "./model";

type Row = Record<string, string | number>;
export function RecordGrid({ rows }: { rows: Row[] }) {
  const headers = Object.keys(rows[0] || {});
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row["Record"] || i)}>
              {headers.map((h) => (
                <td key={h}>
                  {h === "Operation" ? (
                    <Link
                      className="record-link"
                      to="/operations/$operationId"
                      params={{ operationId: String(row[h]) }}
                    >
                      {row[h]}
                    </Link>
                  ) : typeof row[h] === "number" ? (
                    money(Number(row[h]))
                  ) : (
                    String(row[h])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
export function DepartmentDocuments({
  operation = "",
  department = "",
}: {
  operation?: string;
  department?: string;
}) {
  return <DocumentPanel operation={operation} department={department} />;
}
export function CategoryWorkspace({ section: key }: { section: string }) {
  const ws = useWorkspace();
  const section = navigation.find((s) => s.key === key);
  const [savedTab, setTab] = useSessionField(`${key}:tab`, section?.tabs[0] || "");
  const [op, setOp] = useSessionField("active-operation");
  const [q, setQ] = useSessionField(`${key}:search`);
  const [from, setFrom] = useSessionField(`${key}:from`, "");
  const [to, setTo] = useSessionField(`${key}:to`, "");
  const [status, setStatus] = useSessionField(`${key}:status`);
  const [stage, setStage] = useSessionField(`${key}:stage`);
  const [add, setAdd] = useState(false);
  if (!section) return <Empty text="This workspace was not found." />;
  if (!visibleSection(ws.role, section))
    return <Empty text="This workspace is not available for your staff role." />;
  if (key.endsWith("approvals"))
    return <Approvals scope={key.startsWith("logistics") ? "logistics" : "transport"} />;
  const tab = section.tabs.includes(savedTab) ? savedTab : section.tabs[0] || "";
  const match = (record: unknown) => JSON.stringify(record).toLowerCase().includes(q.toLowerCase());
  const ops = ws.operations.filter((o) => (!op || o.id === op) && match(o));
  const ids = ws.operations.filter((o) => !op || o.id === op).map((o) => o.id);
  const costs = ws.costs.filter((c) => ids.includes(c.operationId) && match(c));
  const trips = ws.trips.filter((t) => ids.includes(t.operationId) && match(t));
  const invoices = ws.invoices.filter((i) => ids.includes(i.operationId) && match(i));
  const stages = ws.stages.filter((s) => ids.includes(s.operationId) && match(s));
  const inDate = (date: string) => (!from || date >= from) && (!to || date <= to);
  const isReport = key.endsWith("reports");
  const summaryRows = ops.map((o) => {
    const s = financialSummary(o, ws.costs, ws.trips, ws.invoices);
    return {
      Record: o.id,
      Operation: o.id,
      Customer: o.customer,
      Customer_charges_ETB: s.revenue,
      Approved_costs_ETB: s.costs,
      Received_ETB: s.received,
      Estimated_profit_ETB: s.profit,
      Status: o.status,
    };
  });
  const costRows = (items: typeof costs): Row[] =>
    items.map((c) => ({
      Record: c.id,
      Operation: c.operationId,
      Stage: c.stageId || "—",
      Category: c.category,
      Supplier: c.supplier,
      Original_amount: c.amount,
      Currency: c.currency,
      Historical_rate: c.rate,
      Cost_ETB: convertedCost(c),
      Status: c.approval,
      Date: c.date,
    }));
  const tripRows = (items: typeof trips): Row[] =>
    items.map((t) => ({
      Record: t.id,
      Operation: t.operationId,
      Truck: t.truck,
      Ownership: t.ownership,
      Freight: t.freight,
      Departure: t.departure,
      Delivery: t.arrival,
      Cost_ETB: t.cost,
      Settled_ETB: t.paid,
      Balance_ETB: t.cost - t.paid,
      Status: t.status,
    }));
  const invoiceRows = (items: typeof invoices): Row[] =>
    items.map((i) => ({
      Record: i.id,
      Operation: i.operationId,
      Invoiced_ETB: i.amount,
      Received_ETB: i.paid,
      Balance_ETB: i.amount - i.paid,
      Due: i.due,
      Status: i.status,
    }));
  let rows: Row[] = [];
  let countFor = (_label: string): number => 0;
  let content: ReactNode;
  if (key === "freight-cargo") {
    const filtered = ops.filter((o) => freightMatches(o, tab));
    countFor = (label) => ops.filter((o) => freightMatches(o, label)).length;
    content = <FreightPanel operation={op} />;
  } else if (key === "truck-assignment") {
    countFor = (label) =>
      label === "Requests"
        ? ops.filter((o) => o.ready && o.status !== "Delivered").length
        : label === "Assignment History"
          ? trips.length
          : ws.fleet.filter(
              (t) =>
                t.ownership === (label === "Company Trucks" ? "Company" : "Subcontractor") &&
                match(t),
            ).length;
    if (tab === "Requests")
      content = <TruckRequestPanel operation={op} />;
    else if (tab === "Assignment History") content = <TripTable rows={trips} />;
    else {
      const trucks = ws.fleet.filter(
        (t) => t.ownership === (tab === "Company Trucks" ? "Company" : "Subcontractor") && match(t),
      );
      rows = trucks.map((t) => ({
        Record: t.truck,
        Driver: t.driver,
        Supplier: t.supplier,
        Ownership: t.ownership,
        Capacity_kg: t.capacity,
        Status: ws.trips.some(
          (x) => x.truck === t.truck && !["Completed", "Cancelled"].includes(x.status),
        )
          ? "Assigned"
          : "Available",
      }));
      content = <RecordGrid rows={rows} />;
    }
  } else if (key === "internal-logistics" || key === "other-expenses" || key === "bills-costs") {
    const internal = costs.filter((c) => costDepartment(c) === "internal");
    const internalFilter = (label: string) =>
      internal.filter(
        (c) =>
          label === "Bills & Receipts" ||
          (label === "Local Customs Clearance"
            ? /customs|local clearance/i.test(c.category)
            : label === "Government Duties"
              ? /duties|duty/i.test(c.category)
              : /government/i.test(c.category) && !/duties|duty/i.test(c.category)),
      );
    const billFilter = (label: string) =>
      costs.filter(
        (c) =>
          costDepartment(c) ===
          (label === "External Logistics Bills"
            ? "external"
            : label === "Internal Logistics Bills"
              ? "internal"
              : label === "Transport Costs"
                ? "transport"
                : "other"),
      );
    countFor = (label) =>
      key === "internal-logistics"
        ? label === "Documents"
          ? ws.documents.filter(
              (d) => ids.includes(d.operationId) && /internal|local|government/i.test(d.category),
            ).length
          : internalFilter(label).length
        : label === "Cost Summary"
          ? ops.length
          : label === "Transport Costs"
            ? billFilter(label).length + trips.length
            : billFilter(label).length;
    if (tab === "Documents") content = <DepartmentDocuments operation={op} department="internal" />;
    else if (tab === "Cost Summary") {
      rows = summaryRows;
      content = <RecordGrid rows={rows} />;
    } else {
      const filtered =
        key === "internal-logistics"
          ? internalFilter(tab)
          : key === "other-expenses"
            ? costs.filter((c) => costDepartment(c) === "other")
            : billFilter(tab);
      content = (
        <>
          <CostTable rows={filtered} />
          {tab === "Transport Costs" && (
            <>
              <SectionHeading title="Truck and subcontractor costs" />
              <TripTable rows={trips} />
            </>
          )}
        </>
      );
    }
  } else if (key === "receivables" || key === "customer-payments") {
    const filtered = invoices.filter((i) =>
      key === "customer-payments"
        ? i.paid > 0
        : i.paid < i.amount &&
          !["Draft", "Voided"].includes(i.status) &&
          (tab === "Overdue"
            ? ageDays(i.due) > 0
            : tab === "Current"
              ? ageDays(i.due) === 0
              : true),
    );
    countFor = (label) =>
      invoices.filter(
        (i) =>
          i.paid < i.amount &&
          !["Draft", "Voided"].includes(i.status) &&
          (label === "Overdue"
            ? ageDays(i.due) > 0
            : label === "Current"
              ? ageDays(i.due) === 0
              : true),
      ).length;
    content = key === 'customer-payments' ? <CashWorkspace operation={op} /> : <InvoiceTable rows={filtered} />;
  } else if (key === "logistics-overview") {
    rows = [
      { Record: "Port stages", Count: stages.length },
      { Record: "Delayed stages", Count: stages.filter((s) => s.status === "Delayed").length },
      {
        Record: "External bills",
        Count: costs.filter((c) => costDepartment(c) === "external").length,
      },
      {
        Record: "Internal bills",
        Count: costs.filter((c) => costDepartment(c) === "internal").length,
      },
      {
        Record: "Pending cost approvals",
        Count: costs.filter((c) => c.approval === "Pending").length,
      },
    ];
    content = (
      <>
        <RecordGrid rows={rows} />
        <SectionHeading title="Port stages" />
        <RecordGrid
          rows={stages.map((s) => ({
            Record: s.id,
            Operation: s.operationId,
            Port: s.port,
            Arrival: s.arrival,
            Status: s.status,
          }))}
        />
      </>
    );
  } else if (isReport) {
    const reportRows = (label: string): Row[] => {
      if (key === "logistics-reports") {
        if (label === "Internal")
          return costRows(costs.filter((c) => costDepartment(c) === "internal" && inDate(c.date)));
        if (label === "Costs & Delays")
          return [
            ...costRows(
              costs.filter(
                (c) => ["external", "internal"].includes(costDepartment(c)) && inDate(c.date),
              ),
            ),
            ...stages
              .filter((s) => ["Delayed", "On hold"].includes(s.status) && inDate(s.arrival))
              .map((s) => ({
                Record: s.id,
                Operation: s.operationId,
                Stage: s.id,
                Category: "Port delay",
                Supplier: s.port,
                Original_amount: 0,
                Currency: "—",
                Historical_rate: 0,
                Cost_ETB: 0,
                Status: s.status,
                Date: s.arrival,
              })),
          ];
        return stages
          .filter((s) => inDate(s.arrival))
          .map((s) => ({
            Record: s.id,
            Operation: s.operationId,
            Port: s.port,
            Arrival: s.arrival,
            Release: s.release,
            Status: s.status,
          }));
      }
      if (key === "transport-reports") {
        if (label === "Freight")
          return ops
            .filter((o) => inDate(o.opened))
            .map((o) => ({
              Record: o.id,
              Operation: o.id,
              Freight: o.type,
              Quantity: o.quantity,
              Weight_kg: o.weight,
              Status: o.status,
            }));
        if (label === "Trucks")
          return ws.fleet
            .filter(match)
            .map((t) => ({
              Record: t.truck,
              Ownership: t.ownership,
              Supplier: t.supplier,
              Trips: trips.filter((x) => x.truck === t.truck && inDate(x.departure)).length,
              Status: ws.trips.some(
                (x) => x.truck === t.truck && !["Completed", "Cancelled"].includes(x.status),
              )
                ? "Assigned"
                : "Available",
            }));
        return tripRows(trips.filter((t) => inDate(t.departure)));
      }
      if (label === "Costs")
        return [
          ...costRows(costs.filter((c) => inDate(c.date))),
          ...trips
            .filter((t) => t.status !== "Cancelled" && inDate(t.departure))
            .map((t) => ({
              Record: t.id,
              Operation: t.operationId,
              Stage: "—",
              Category: "Transport",
              Supplier: t.supplier,
              Original_amount: t.cost,
              Currency: "ETB",
              Historical_rate: 1,
              Cost_ETB: t.cost,
              Status: t.status,
              Date: t.departure,
            })),
        ];
      if (label === "Receivables")
        return invoiceRows(
          invoices.filter(
            (i) => i.amount > i.paid && !["Draft", "Voided"].includes(i.status) && inDate(i.issued),
          ),
        );
      if (label === "Payables")
        return tripRows(
          trips.filter(
            (t) =>
              t.ownership === "Subcontractor" &&
              t.status !== "Cancelled" &&
              t.paid < t.cost &&
              inDate(t.departure),
          ),
        );
      return summaryRows
        .filter((r) => inDate(ws.operations.find((o) => o.id === r.Operation)?.opened || ""))
        .map((r) =>
          label === "Revenue"
            ? {
                Record: r.Record,
                Operation: r.Operation,
                Customer: r.Customer,
                Customer_charges_ETB: r.Customer_charges_ETB,
                Received_ETB: r.Received_ETB,
                Status: r.Status,
              }
            : r,
        );
    };
    countFor = (label) => reportRows(label).filter((r) => !status || r["Status"] === status).length;
    rows = reportRows(tab).filter((r) => !status || r["Status"] === status);
    content = <AuthorizedReportPanel query={{ department: key.startsWith("logistics") ? "logistics" : key.startsWith("transport") ? "transport" : "finance", view: tab, operationId: op, search: q, from, to, status }} />;
  } else content = <Empty />;
  return (
    <>
      <PageHeader
        eyebrow={section.module}
        title={section.label}
        description={op ? `Freight operation ${op}` : "All freight operations"}
      >
        
        {key === "truck-assignment" && canWrite(ws.role, "transport") && (
          <Button onClick={() => setAdd(true)}>
            <Plus />
            Assign truck
          </Button>
        )}
        {["internal-logistics", "other-expenses", "bills-costs"].includes(key) &&
          canWrite(ws.role, section.area) && (
            <Button onClick={() => setAdd(true)}>
              <Plus />
              Add expense
            </Button>
          )}
      </PageHeader>
      {key === "internal-logistics" && tab !== "Documents" && <LocalTaskPanel operation={op} />}
      {!!section.tabs.length && (
        <CategoryTabs
          labels={section.tabs}
          value={tab}
          onChange={setTab}
          counts={Object.fromEntries(section.tabs.map((label) => [label, countFor(label)]))}
        />
      )}
      <div className="toolbar px-0">
        <OperationSelect value={op} onChange={setOp} />
        <SearchInput value={q} onChange={setQ} placeholder="Search records…" />
        {isReport && (
          <>
            <label className="form-field">
              From
              <input
                aria-label="Report start date"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="form-field">
              To
              <input
                aria-label="Report end date"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <input
              aria-label="Report status"
              placeholder="Filter status…"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </>
        )}
        {key === "bills-costs" && tab === "External Logistics Bills" && (
          <select
            aria-label="Port stage filter"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">All port stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.port} · {s.id}
              </option>
            ))}
          </select>
        )}
      </div>
      {isReport && from && to && from > to && (
        <p className="form-error" role="alert">
          Start date must be on or before end date.
        </p>
      )}
      {tab === "Documents" ? (
        content
      ) : (
        <section className="panel">
          <SectionHeading title={tab || section.label} />
          {key === "bills-costs" && tab === "External Logistics Bills" && stage ? (
            <CostTable rows={costs.filter((c) => c.stageId === stage)} />
          ) : (
            content
          )}
        </section>
      )}
      <AssignmentForm open={key === "truck-assignment" && add} onClose={() => setAdd(false)} />
      <ChargeForm
        open={key !== "truck-assignment" && add}
        onClose={() => setAdd(false)}
        operationId={op}
        local
      />
    </>
  );
}
