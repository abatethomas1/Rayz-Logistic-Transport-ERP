import type { Role } from "./model";

export type Department = "logistics" | "transport" | "finance";
export type WorkArea = "external" | "internal" | "transport" | "finance";
export type WorkStatus = "Draft" | "Submitted" | "Approved" | "Returned" | "Issued" | "Paid" | "Settled" | "Voided" | "Posted";
export type WorkKind = "Port stage" | "Local clearance task" | "Truck request" | "Assignment" | "Trip" | "Bill" | "Invoice" | "Expense" | "Payment" | "Payable" | "Settlement" | "Correction" | "Reversal" | "Void" | "Rate card";
export type WorkEvent = { actor: string; action: string; reason: string; time: string };
export type WorkRecord = {
  id: string; area: WorkArea; kind: WorkKind; operationId: string; title: string;
  amount: number; details: string; documents: string[]; dependencies: number;
  createdBy: string; assignedTo: string; submittedBy: string; status: WorkStatus;
  payload: Record<string, string>; history: WorkEvent[];
};
export type Actor = { id: string; name: string; role: Role; area: WorkArea | null; department: Department | null; manager: boolean; general: boolean };
export const departmentFor = (area: WorkArea): Department => area === "external" || area === "internal" ? "logistics" : area;
export function actorFor(role: Role): Actor {
  const area: WorkArea | null = ["External Logistics Officer", "Logistics Officer"].includes(role) ? "external" : role === "Internal Logistics Officer" ? "internal" : ["Transport Officer", "Dispatcher"].includes(role) ? "transport" : ["Finance Officer", "Accountant"].includes(role) ? "finance" : null;
  const general = ["General Manager", "Manager", "Business Owner"].includes(role);
  const department: Department | null = area ? departmentFor(area) : role === "Logistics Manager" ? "logistics" : role === "Transport Manager" ? "transport" : role === "Finance Manager" ? "finance" : null;
  const names: Record<string, string> = { external: "Meron Tadesse", internal: "Abel Girma", transport: "Abebe Alemu", finance: "Selam Abebe", "Logistics Manager": "Hana Tesfaye", "Transport Manager": "Tesfaye Bekele", "Finance Manager": "Dawit Mekonnen", "General Manager": "Osman Abate", "Manager": "Osman Abate", "Business Owner": "Osman Abate", "Admin": "System Administrator" };
  const id = area ? `officer-${area}` : general ? "general-manager" : role;
  return { id, name: names[area || role] || role, role, area, department, manager: general || role.endsWith("Manager"), general };
}
export function canReadWork(actor: Actor, record: WorkRecord) {
  if (actor.general || actor.role === "Admin") return true;
  if (actor.manager) return actor.department === departmentFor(record.area);
  return actor.area === record.area && actor.id === record.assignedTo;
}
export function canCreateWork(actor: Actor, area: WorkArea) {
  return actor.general || (actor.manager ? actor.department === departmentFor(area) : actor.area === area);
}
export function canEditWork(actor: Actor, record: WorkRecord) {
  return canReadWork(actor, record) && canCreateWork(actor, record.area) && ["Draft", "Returned"].includes(record.status);
}
export function canDeleteWork(actor: Actor, record: WorkRecord) {
  return actor.area !== null && !actor.manager && canEditWork(actor, record) && record.status === "Draft" && record.createdBy === actor.id && record.documents.length === 0 && record.dependencies === 0 && record.history.every((e) => !["Submitted", "Approved"].includes(e.action));
}
export function canReviewWork(actor: Actor, record: WorkRecord) {
  return actor.manager && canReadWork(actor, record) && record.status === "Submitted" && record.createdBy !== actor.id && record.submittedBy !== actor.id;
}
export function nextApprover(record: WorkRecord) {
  const managerRole = `${departmentFor(record.area)[0]?.toUpperCase()}${departmentFor(record.area).slice(1)} Manager` as Role;
  const manager = actorFor(managerRole);
  return record.createdBy === manager.id || record.submittedBy === manager.id || record.createdBy === "general-manager" || record.submittedBy === "general-manager" ? "General Manager / another authorized approver" : managerRole;
}
export function transitionWork(record: WorkRecord, actor: Actor, action: "Submitted" | "Approved" | "Returned", reason = ""): WorkRecord {
  if (action === "Submitted" ? !canEditWork(actor, record) : !canReviewWork(actor, record)) throw new Error("This action is not available to this person for this record.");
  if (action === "Returned" && !reason.trim()) throw new Error("A return reason is required.");
  return { ...record, status: action, submittedBy: action === "Submitted" ? actor.id : record.submittedBy, history: [...record.history, { actor: actor.name, action, reason: reason.trim(), time: new Date().toLocaleString("en-GB") }] };
}
export const kindsFor = (area: WorkArea): WorkKind[] => area === "external" ? ["Port stage", "Bill", "Correction", "Void"] : area === "internal" ? ["Local clearance task", "Bill", "Correction", "Void"] : area === "transport" ? ["Truck request", "Assignment", "Trip", "Correction", "Void"] : ["Bill", "Invoice", "Expense", "Payment", "Payable", "Settlement", "Correction", "Reversal", "Void", "Rate card"];
export function initialWork(): WorkRecord[] {
  return (["external", "internal", "transport", "finance"] as WorkArea[]).map((area, index) => ({
    id: `WK-10${index + 1}`, area, kind: area === "external" ? "Port stage" : area === "internal" ? "Local clearance task" : area === "transport" ? "Truck request" : "Expense",
    operationId: area === "transport" ? "RZ-2026-1046" : "RZ-2026-1048", title: area === "external" ? "Djibouti port inspection" : area === "internal" ? "Addis Ababa local clearance" : area === "transport" ? "Two trucks for Awash Agro" : "Office handling expense",
    amount: area === "finance" ? 12500 : 0, details: "Awaiting department review", documents: ["Supporting request.pdf"], dependencies: 0,
    createdBy: `officer-${area}`, assignedTo: `officer-${area}`, submittedBy: `officer-${area}`, status: "Submitted", payload: {},
    history: [{ actor: actorFor(area === "external" ? "External Logistics Officer" : area === "internal" ? "Internal Logistics Officer" : area === "transport" ? "Dispatcher" : "Finance Officer").name, action: "Submitted", reason: "", time: "21/11/2026, 09:00:00" }],
  }));
}