import { useState } from "react";
import { Plus, Check, Undo2, Send, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, useSessionField } from "./store";
import { Badge, Button, Empty, FormModal, Modal, SectionHeading } from "./ui";
import { CategoryTabs } from "./category-tabs";
import { DocumentPanel } from "./document-panel";
import { independentReversalApprover } from "./production-model";
import { money } from "./model";
import { canCreateWork, canEditWork, canDeleteWork, canReviewWork, departmentFor, kindsFor, nextApprover, type Department, type WorkArea, type WorkKind, type WorkRecord } from "./approval-model";

export function WorkPanel({ department, queue = false, initialArea }: { department: Department; queue?: boolean; initialArea?: WorkArea }) {
  const ws = useWorkspace();
  const [area, setArea] = useSessionField(`work:${department}:area`, initialArea || ws.actor.area || (department === "logistics" ? "external" : department));
  const currentArea: WorkArea = department === "logistics" ? (initialArea || (ws.actor.area === "internal" ? "internal" : ws.actor.area === "external" ? "external" : area === "internal" ? "internal" : "external")) : department;
  const [tab, setTab] = useSessionField(`work:${department}:status`, "All");
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<WorkRecord | null>(null);
  const [create, setCreate] = useState(false);
  const [reason, setReason] = useState("");
  const record = ws.work.find((w) => w.id === selected);
  const base = ws.work.filter((w) => departmentFor(w.area) === department && (queue || w.area === currentArea));
  const rows = base.filter((w) => queue ? w.status === "Submitted" : tab === "All" || w.status === tab);
  const statuses = ["All", "Draft", "Submitted", "Approved", "Returned", "Issued", "Paid", "Settled", "Voided", "Posted"];
  const perform = async (fn: () => Promise<unknown>, message: string) => { try { await fn(); toast.success(message); } catch (e) { toast.error(e instanceof Error ? e.message : "Action unavailable"); } };
  if (queue && !ws.actor.manager) return <Empty text="Only the department manager or an authorized general approver can review submissions." />;
  return <section className="work-section">
    <SectionHeading title={queue ? `${department[0]?.toUpperCase()}${department.slice(1)} approval queue` : ws.actor.manager ? "Department work" : "My assigned work"}>
      {!queue && canCreateWork(ws.actor, currentArea) && <Button size="sm" onClick={() => setCreate(true)}><Plus />New draft</Button>}
    </SectionHeading>
    {!queue && department === "logistics" && !initialArea && !ws.actor.area && <CategoryTabs labels={["external", "internal"]} value={currentArea} onChange={setArea} />}
    {!queue && <CategoryTabs labels={statuses} value={tab} onChange={setTab} counts={Object.fromEntries(statuses.map((s) => [s, base.filter((w) => s === "All" || w.status === s).length]))} />}
    <div className="table-scroll"><table><thead><tr><th>Submission / operation</th><th>Assigned staff / submitter</th><th>Amount</th><th>Status / next approver</th><th>Next action</th></tr></thead><tbody>
      {rows.map((w) => <tr key={w.id}>
        <td><strong>{w.title}</strong><span className="cell-sub">{w.id} · {w.kind} · {w.operationId}</span></td>
        <td>{ws.staff.find((s) => s.id === w.assignedTo)?.display_name || (w.assignedTo === ws.actor.id ? ws.actor.name : "Assigned staff")}<span className="cell-sub">Submitted by: {w.history.slice().reverse().find((e) => e.action === "Submitted")?.actor || "Not submitted"}</span></td>
        <td>{money(w.amount)} ETB</td><td><Badge status={w.status} /><span className="cell-sub">{w.status === "Submitted" ? nextApprover(w) : w.status === "Returned" ? w.history.at(-1)?.reason : ""}</span></td>
        <td><div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setSelected(w.id); setReason(""); }}>{queue ? "Review" : "Details"}</Button>
          {!queue && canEditWork(ws.actor, w) && <>
            <Button variant="outline" size="icon" title="Edit draft" aria-label={`Edit ${w.title}`} onClick={() => setEditing(w)}><Pencil /></Button>
            <Button size="sm" onClick={() => perform(() => ws.decideWork(w.id, "Submitted"), "Submitted to the department approver")}><Send />Submit</Button>
          </>}
          {!queue && canDeleteWork(ws.actor, w) && <Button variant="ghost" size="icon" title="Delete unused draft" aria-label={`Delete ${w.title}`} onClick={() => { if (window.confirm(`Delete unused draft ${w.title}?`)) perform(() => ws.deleteWork(w.id), "Unused draft deleted; audit retained"); }}><Trash2 /></Button>}
          {w.status === "Approved" && ["Invoice", "Payment", "Settlement", "Reversal", "Void", "Port stage", "Local clearance task", "Truck request", "Assignment", "Trip", "Bill", "Expense", "Rate card"].includes(w.kind) && canCreateWork(ws.actor, w.area) && <Button variant="outline" size="sm" onClick={() => perform(() => ["Invoice", "Payment", "Settlement", "Reversal", "Void"].includes(w.kind) ? ws.postWork(w.id) : ws.operationalAction({ action: "post", id: w.id }), "Approved transaction posted")}>{w.kind === "Invoice" ? "Issue" : "Post"}</Button>}
        </div></td>
      </tr>)}
    </tbody></table>{!rows.length && <Empty text={queue ? "No submissions await review in this department." : "No assigned work in this status."} />}</div>
    <DraftEditor open={create || !!editing} record={editing} area={currentArea} onClose={() => { setCreate(false); setEditing(null); }} />
    <Modal open={!!record} onClose={() => setSelected("")} title={record?.title || "Submission"}>
      {record && <>
        <div className="detail-fields"><div><p>Submission</p><strong>{record.id} · {record.kind}</strong></div><div><p>Operation</p><strong>{record.operationId}</strong></div><div><p>Submitter</p><strong>{record.history.slice().reverse().find((e) => e.action === "Submitted")?.actor || "Not submitted"}</strong></div><div><p>Amount</p><strong>{money(record.amount)} ETB</strong></div></div>
        <Badge status={record.status} /><p>{record.details || "No additional details"}</p>
        {Object.entries(record.payload).map(([key, value]) => <p key={key}><strong>{key}: </strong>{value}</p>)}
        <h3>Supporting documents</h3>{record.documents.map((d) => <p key={d}><FileText size={14} className="inline" /> {d}</p>)}{!record.documents.length && <p>No documents attached</p>}
        <DocumentPanel operation={record.operationId} department={record.area} workId={record.id} />
        <h3>History</h3>{record.history.map((e, i) => <div className="audit-item" key={i}><div><strong>{e.action} · {e.actor}</strong><p>{e.time}{e.reason ? ` · ${e.reason}` : ""}</p></div></div>)}
        {ws.actor.manager && canEditWork(ws.actor, record) && <label className="form-field">Assigned staff<select aria-label="Assigned staff" value={record.assignedTo} onChange={(e) => perform(() => ws.assignWork(record.id, e.target.value), "Staff assignment recorded")}><option value={record.assignedTo}>{ws.staff.find((s) => s.id === record.assignedTo)?.display_name || record.assignedTo}</option>{ws.assignments.filter((a) => a.operation_id === record.operationId && a.area === record.area && a.user_id !== record.assignedTo).map((a) => <option key={a.user_id} value={a.user_id}>{ws.staff.find((s) => s.id === a.user_id)?.display_name || a.user_id}</option>)}</select></label>}
        {record.status === "Submitted" && !canReviewWork(ws.actor, record) && <p className="note">{record.createdBy === ws.actor.id || record.submittedBy === ws.actor.id ? "You cannot approve your own creation or submission. " : ""}Next approver: {nextApprover(record)}</p>}
        {canReviewWork(ws.actor, record) && <><label className="form-field">Return reason<textarea aria-label="Return reason" value={reason} onChange={(e) => setReason(e.target.value)} /></label><div className="form-footer"><Button disabled={ws.pending} variant="outline" onClick={() => perform(async () => { await ws.decideWork(record.id, "Returned", reason); setSelected(""); }, "Returned to assigned staff")}><Undo2 />Return</Button><Button disabled={ws.pending || (record.area === 'finance' && ['Reversal', 'Void'].includes(record.kind) && !independentReversalApprover(ws.role, ws.actor.id, record.createdBy, record.submittedBy))} onClick={() => perform(async () => { await ws.decideWork(record.id, "Approved"); setSelected(""); }, "Submission approved")}><Check />Approve</Button></div></>}
        <Button variant="outline" onClick={() => window.print()}><FileText />Print submission</Button>
      </>}
    </Modal>
  </section>;
}

function DraftEditor({ open, onClose, area, record }: { open: boolean; onClose: () => void; area: WorkArea; record: WorkRecord | null }) {
  const ws = useWorkspace();
  return <FormModal key={record?.id || `${area}-${open}`} open={open} onClose={onClose} title={record ? "Edit assigned draft" : "Create assigned draft"} submit="Save draft" fields={[
    ...(!record ? [{ name: "kind", label: "Record type", options: kindsFor(area) }, { name: "operation", label: "Freight operation", options: ws.operations.map((o) => o.id) }] : []),
    { name: "title", label: "Record name", value: record?.title || "" },
    { name: "amount", label: "Amount (ETB)", type: "number", value: String(record?.amount || 0) },
    { name: "details", label: "Details / correction reason", value: record?.details || "", required: false },
    { name: "documents", label: "Supporting document names (comma separated)", value: record?.documents.join(", ") || "", required: false },
    ...(record ? [{ name: 'payload', label: 'Supporting inputs (JSON)', value: JSON.stringify(record.payload), required: false }] : []),
    ...(!record && area === "finance" ? [{ name: "sourceId", label: "Invoice / payable / correction reference", options: ["Not applicable", ...ws.invoices.map((i) => i.id), ...ws.trips.filter((t) => t.ownership === "Subcontractor").map((t) => t.id)], required: false }] : []),
  ]} onSubmit={async (d) => {
    const kind = (d["kind"] || record?.kind || kindsFor(area)[0]) as WorkKind;
    if (["Correction", "Reversal", "Void"].includes(kind) && !d["details"]?.trim()) throw new Error("A correction, reversal or void reason is required.");
    if (["Invoice", "Payment", "Settlement", "Bill", "Expense", "Payable", "Rate card"].includes(kind) && Number(d["amount"]) <= 0) throw new Error("Enter a positive transaction amount.");
    const docs = (d["documents"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (record) { const payload: unknown = JSON.parse(d['payload'] || '{}'); if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.values(payload).every((v) => typeof v === 'string')) throw new Error('Supporting inputs must contain text values.'); await ws.editWork(record.id, { title: d["title"] || "", amount: Number(d["amount"]), details: d["details"] || "", documents: docs, payload: payload as Record<string, string> }); }
    else await ws.createWork(area, kind, d["operation"] || "", d["title"] || "", Number(d["amount"]), { sourceId: d["sourceId"] || "" }, d["details"] || "", docs);
    toast.success("Draft saved; submit when ready");
  }} />;
}