import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Truck, ArrowUpRight, FileText, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useSessionField } from "./store";
import { CategoryTabs } from "./category-tabs";
import { MasterEditor } from "./master-editor";
import { MilestoneControls, TruckRequestPanel } from "./operational-panels";
import { DocumentPanel } from "./document-panel";
import { canMaintainMaster } from "./production-model";
import { canWrite, money, dateLabel, tripStates, type Trip } from "./model";
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
export function AssignmentForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ws = useWorkspace();
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Assign freight to a truck"
      submit="Create assignment"
      fields={[
        {
          name: "operation",
          label: "Freight operation",
          options: ws.operations
            .filter((o) => o.ready && o.status !== "Delivered")
            .map((o) => o.id),
        },
        {
          name: "truck",
          label: "Truck / driver / fleet",
          options: ws.fleet.filter((t) => t.active).map((t) => `${t.truck} · ${t.driver} · ${t.ownership}`),
        },
        { name: "freightId", label: "Cleared freight item", options: ws.freight.filter((f) => f.ready).map((f) => `${f.id} · ${f.identifier}`) },
        { name: "requestId", label: "Open truck request", options: ws.requests.filter((r) => r.status === "Open").map((r) => r.id) },
        { name: "count", label: "Requested trucks", type: "number", value: "1" },
        { name: "departure", label: "Departure date", type: "date", value: new Date().toISOString().slice(0, 10) },
        { name: "arrival", label: "Expected arrival", type: "date", value: "" },
        { name: "charge", label: "Customer charge (ETB)", type: "number", value: "" },
        {
          name: "cost",
          label: "Actual truck / subcontractor cost (ETB)",
          type: "number",
          value: "",
        },
      ]}
      onSubmit={async (d) => {
        if (!canWrite(ws.role, "transport"))
          throw new Error("Your staff role cannot assign freight.");
        const op = ws.operations.find((o) => o.id === d["operation"]);
        if (!op) throw new Error("This freight has a dispatch blocker.");
        const truck = ws.fleet.find((t) => t.truck === (d["truck"] || "").split(" · ")[0]);
        if (!truck) throw new Error("Select an available truck.");
        if (
          ws.trips.some(
            (t) => t.truck === truck.truck && !["Completed", "Cancelled"].includes(t.status),
          )
        )
          throw new Error("This truck already has an unfinished trip. Choose an available truck.");
        if (Number(d["count"]) !== 1)
          throw new Error(
            "Create one assignment per truck; repeat for additional requested trucks.",
          );
        const item = ws.freight.find((f) => f.id === (d["freightId"] || "").split(" · ")[0] && f.operation_id === op.id);
        if (!item?.ready) throw new Error("Choose a cleared freight item on this operation.");
        const freight = item.identifier;
        if (op.containers.length && !op.containers.includes(freight))
          throw new Error("Enter an exact container identifier belonging to this operation.");
        if (
          ws.trips.some(
            (t) => t.operationId === op.id && t.freight === freight && t.status !== "Cancelled",
          )
        )
          throw new Error("This freight already has an assignment.");
        if (Number(d["cost"]) <= 0 || Number(d["charge"]) <= 0)
          throw new Error("Enter positive customer charges and actual costs.");
        if ((d["arrival"] || "") < (d["departure"] || ""))
          throw new Error("Arrival cannot precede departure.");
        const id = `TR-${2085 + ws.trips.length - 5}`;
        await ws.createWork("transport", "Assignment", op.id, `${freight} → ${truck.truck}`, Number(d["cost"]), { ...d, freightId: item.id, freight, sourceId: id, driver: truck.driver, ownership: truck.ownership, supplier: truck.supplier });
        toast.success("Assignment saved as Draft; submit for Transport Manager review");
      }}
    />
  );
}
export function Dispatch() {
  const ws = useWorkspace();
  const [assign, setAssign] = useState(false);
  const [view, setView] = useSessionField("transport-overview:tab", "Dispatch Board");
  const [op, setOp] = useSessionField("active-operation");
  const [detail, setDetail] = useState("");
  const ready = ws.operations.filter((o) => o.status !== "Delivered" && (!op || o.id === op));
  const trips = ws.trips.filter((t) => !op || t.operationId === op);
  if (view === "Fleet & Partners")
    return (
      <>
        <CategoryTabs
          labels={["Dispatch Board", "Fleet & Partners"]}
          value={view}
          onChange={setView}
        />
        <Fleet />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="TRANSPORT"
        title="Dispatch board"
        description="Dispatch cleared freight while other port activities continue."
      >
        {canWrite(ws.role, "transport") && (
          <Button onClick={() => setAssign(true)}>
            <Plus />
            Assign truck
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/trips">
            All trips
            <ArrowUpRight />
          </Link>
        </Button>
      </PageHeader>
      <CategoryTabs
        labels={["Dispatch Board", "Fleet & Partners"]}
        value={view}
        onChange={setView}
      />
      <div className="toolbar px-0">
        <OperationSelect value={op} onChange={setOp} />
        <span className="toolbar-count">
          {trips.filter((t) => t.status === "Active").length} active trips ·{" "}
          {ready.filter((o) => !o.ready).length} blocked operations
        </span>
      </div>
      <div className="dispatch-grid">
        {["Awaiting readiness", "Ready to assign", "On the road", "Arrived & delivered"].map(
          (column, i) => (
            <div className="dispatch-column" key={column}>
              <div className="dispatch-column-header">
                {column}
                <span>
                  {i < 2
                    ? ready.filter((o) => (i === 0 ? !o.ready : o.ready)).length
                    : trips.filter((t) =>
                        i === 2
                          ? ["Assigned", "Active"].includes(t.status)
                          : ["Arrived", "Offloaded", "Completed"].includes(t.status),
                      ).length}
                </span>
              </div>
              {i < 2
                ? ready
                    .filter((o) => (i === 0 ? !o.ready : o.ready))
                    .map((o) => (
                      <article className="dispatch-card" key={o.id}>
                        <Link
                          className="record-link"
                          to="/operations/$operationId"
                          params={{ operationId: o.id }}
                        >
                          {o.id}
                        </Link>
                        <h3>{o.customer}</h3>
                        <p>
                          {o.origin.split(",")[0]} → {o.destination}
                        </p>
                        <p>
                          {o.quantity} × {o.type} · {o.weight / 1000}t
                        </p>
                        <Badge status={o.ready ? "Ready for dispatch" : "On hold"} />
                        <p>{o.blocker || "Freight released for inland transport"}</p>
                        <div className="dispatch-card-bottom">
                          <span>{dateLabel(o.due)}</span>
                          {canWrite(ws.role, "transport") && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!o.ready}
                              onClick={() => setAssign(true)}
                            >
                              <Plus />
                              Assign
                            </Button>
                          )}
                        </div>
                      </article>
                    ))
                : trips
                    .filter((t) =>
                      i === 2
                        ? ["Assigned", "Active"].includes(t.status)
                        : ["Arrived", "Offloaded", "Completed"].includes(t.status),
                    )
                    .map((t) => (
                      <article className="dispatch-card" key={t.id}>
                        <div className="flex justify-between">
                          <strong className="record-link">{t.id}</strong>
                          <Truck size={15} />
                        </div>
                        <h3>{t.truck}</h3>
                        <p>
                          {t.driver} · {t.ownership}
                        </p>
                        <p>{t.operationId}</p>
                        <Badge status={t.status} />
                        <p>{t.freight}</p>
                        <div className="dispatch-card-bottom">
                          <span>ETA {dateLabel(t.arrival)}</span>
                          <Button size="sm" variant="ghost" onClick={() => setDetail(t.id)}>
                            Details
                            <ArrowUpRight />
                          </Button>
                        </div>
                      </article>
                    ))}
            </div>
          ),
        )}
      </div>
      <TruckRequestPanel operation={op} />
      <AssignmentForm open={assign} onClose={() => setAssign(false)} />
      <TripDetail id={detail} onClose={() => setDetail("")} />
    </>
  );
}
export function TripTable({ rows }: { rows: Trip[] }) {
  const [detail, setDetail] = useState("");
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Trip / operation</th>
              <th>Truck / driver</th>
              <th>Freight</th>
              <th>Departure / arrival</th>
              <th>Customer charge</th>
              <th>Actual cost</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong className="record-link">{t.id}</strong>
                  <Link
                    className="cell-sub"
                    to="/operations/$operationId"
                    params={{ operationId: t.operationId }}
                  >
                    {t.operationId}
                  </Link>
                </td>
                <td>
                  {t.truck}
                  <span className="cell-sub">
                    {t.driver} · {t.ownership}
                  </span>
                </td>
                <td>{t.freight}</td>
                <td>
                  {dateLabel(t.departure)}
                  <span className="cell-sub">ETA {dateLabel(t.arrival)}</span>
                </td>
                <td>{money(t.charge)} ETB</td>
                <td>{money(t.cost)} ETB</td>
                <td>
                  <Badge status={t.status} />
                </td>
                <td>
                  <Button variant="ghost" size="sm" onClick={() => setDetail(t.id)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
      <TripDetail id={detail} onClose={() => setDetail("")} />
    </>
  );
}
export function Trips() {
  const ws = useWorkspace();
  const [q, setQ] = useSessionField("trips:search");
  const [status, setStatus] = useSessionField("trips:status", "All");
  const [op, setOp] = useSessionField("active-operation");
  const [assign, setAssign] = useState(false);
  const baseRows = ws.trips.filter(
    (t) =>
      (!op || t.operationId === op) &&
      [t.id, t.truck, t.driver, t.freight].some((x) => x.toLowerCase().includes(q.toLowerCase())),
  );
  const rows = baseRows.filter((t) => status === "All" || !status || t.status === status);
  return (
    <>
      <PageHeader
        eyebrow="TRANSPORT"
        title="Trips"
        description="Follow assignments, delivery milestones, costs, and proof of delivery."
      >
        {canWrite(ws.role, "transport") && (
          <Button onClick={() => setAssign(true)}>
            <Plus />
            Assign truck
          </Button>
        )}
      </PageHeader>
      <CategoryTabs
        labels={["All", ...tripStates]}
        value={status || "All"}
        onChange={setStatus}
        counts={Object.fromEntries(
          ["All", ...tripStates].map((label) => [
            label,
            baseRows.filter((t) => label === "All" || t.status === label).length,
          ]),
        )}
      />
      <section className="panel">
        <div className="toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search trip, truck, driver…" />
          <OperationSelect value={op} onChange={setOp} />
          <select
            aria-label="Trip status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="All">All statuses</option>
            {tripStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <ExportButton
            name="rayz-trips"
            rows={rows.map((t) => ({
              Trip: t.id,
              Operation: t.operationId,
              Truck: t.truck,
              Status: t.status,
              Customer_charge_ETB: t.charge,
              Cost_ETB: t.cost,
            }))}
          />
        </div>
        <TripTable rows={rows} />
      </section>
      <AssignmentForm open={assign} onClose={() => setAssign(false)} />
    </>
  );
}
function TripDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const ws = useWorkspace();
  const trip = ws.trips.find((t) => t.id === id);
  return <Modal open={!!trip} onClose={onClose} title={`${trip?.id || "Trip"} · ${trip?.truck || ""}`}>
    {trip && <><div className="detail-fields">
      <div><p>Operation</p><strong>{trip.operationId}</strong></div><div><p>Driver</p><strong>{trip.driver}</strong></div>
      <div><p>Freight</p><strong>{trip.freight}</strong></div><div><p>Proof of delivery</p><strong>{trip.pod || "Not attached"}</strong></div>
      <div><p>Departure / arrival</p><strong>{dateLabel(trip.departure)} / {dateLabel(trip.arrival)}</strong></div>
      <div><p>Cost</p><strong>{money(trip.cost)} ETB</strong></div>
    </div><Badge status={trip.status} />
    <MilestoneControls id={trip.id} kind="tripStatus" status={trip.status} />
    <DocumentPanel operation={trip.operationId} department="transport" tripId={trip.id} />
    {canWrite(ws.role, "transport") && <Button variant="outline" onClick={async () => { try { await ws.createWork("transport", "Correction", trip.operationId, `Trip correction · ${trip.id}`, 0, { sourceId: trip.id }, "Review proposed trip correction"); toast.success("Correction draft saved in assigned work"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save draft"); } }}>Request correction</Button>}
    <Button variant="outline" onClick={() => window.print()}><FileText />Print trip</Button></>}
  </Modal>;
}
export function Fleet() {
  const ws = useWorkspace();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Record<string, string | number | boolean> | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="TRANSPORT"
        title="Fleet & partners"
        description="Company trucks and subcontractor capacity in one directory."
      >{canMaintainMaster(ws.role, "truck") && <Button onClick={() => setEditing({})}><Plus />Add truck</Button>}</PageHeader>
      <div className="toolbar px-0">
        <select
          aria-label="Fleet ownership"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All fleet types</option>
          <option>Company</option>
          <option>Subcontractor</option>
        </select>
      </div>
      <div className="fleet-grid">
        {ws.fleet
          .filter((t) => !filter || t.ownership === filter)
          .map((t) => (
            <section className="fleet-card" key={t.truck}>
              <Truck size={28} />
              <h3>{t.truck}</h3>
              <p>
                {t.ownership} · {t.supplier}
              </p>
              <p>Driver: {t.driver}</p>
              <p>
                Trailer: {t.trailer} · capacity {t.capacity / 1000}t
              </p>
              {canMaintainMaster(ws.role, "truck") && <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Edit truck</Button>}
              <Badge
                status={
                  ws.trips.some(
                    (x) => x.truck === t.truck && !["Completed", "Cancelled"].includes(x.status),
                  )
                    ? "Assigned"
                    : "Ready for dispatch"
                }
              />
            </section>
          ))}
      </div>
      {editing && <MasterEditor kind="truck" open onClose={() => setEditing(null)} initial={editing} />}
    </>
  );
}
