import { describe, expect, it } from "vitest";
import { actorFor, canCreateWork, canReadWork, canEditWork, canDeleteWork, canReviewWork, initialWork, transitionWork, nextApprover, type WorkRecord, type WorkStatus } from "./approval-model";
const external = actorFor("External Logistics Officer");
const manager = actorFor("Logistics Manager");
function draft(fields: Partial<WorkRecord> = {}): WorkRecord {
  const base = initialWork()[0];
  if (!base) throw new Error("Missing example");
  return { ...base, status: "Draft", documents: [], submittedBy: "", history: [], ...fields };
}
describe("Department approval policy", () => {
  it.each(["External Logistics Officer", "Internal Logistics Officer"] as const)("routes %s to Logistics Manager", (role) => {
    const actor = actorFor(role);
    const w = draft({ area: actor.area || "external", createdBy: actor.id, assignedTo: actor.id });
    expect(canCreateWork(actor, w.area)).toBe(true);
    const submitted = transitionWork(w, actor, "Submitted");
    expect(canReviewWork(manager, submitted)).toBe(true);
    expect(nextApprover(submitted)).toBe("Logistics Manager");
  });
  it.each([["Transport Officer", "Transport Manager"], ["Dispatcher", "Transport Manager"], ["Finance Officer", "Finance Manager"], ["Accountant", "Finance Manager"]] as const)("routes %s to %s", (role, managerRole) => {
    const actor = actorFor(role);
    const w = draft({ area: actor.area || "transport", createdBy: actor.id, assignedTo: actor.id });
    const submitted = transitionWork(w, actor, "Submitted");
    expect(canReviewWork(actorFor(managerRole), submitted)).toBe(true);
    expect(canReviewWork(manager, submitted)).toBe(false);
  });
  it("officers cannot approve even their assigned submitted work", () => {
    expect(() => transitionWork(draft({ status: "Submitted" }), external, "Approved")).toThrow();
  });
  it("officers cannot view, edit or create outside their assignment and area", () => {
    expect(canReadWork(external, draft({ assignedTo: "someone-else" }))).toBe(false);
    expect(canEditWork(external, draft({ area: "internal" }))).toBe(false);
    expect(canCreateWork(external, "finance")).toBe(false);
  });
  it.each(["Draft", "Returned"] as const)("allows assigned officers to edit %s", (status) => expect(canEditWork(external, draft({ status }))).toBe(true));
  it("deletes only own unused Draft without documents or dependencies", () => {
    expect(canDeleteWork(external, draft())).toBe(true);
    expect(canDeleteWork(external, draft({ createdBy: "another-user" }))).toBe(false);
    expect(canDeleteWork(external, draft({ documents: ["bill.pdf"] }))).toBe(false);
    expect(canDeleteWork(external, draft({ dependencies: 1 }))).toBe(false);
  });
  it("managers cannot delete their own drafts", () => {
    expect(canDeleteWork(manager, draft({ createdBy: manager.id, assignedTo: manager.id }))).toBe(false);
  });
  it.each(["Submitted", "Approved", "Issued", "Paid", "Settled", "Voided", "Returned"] as WorkStatus[])("never deletes %s", (status) => expect(canDeleteWork(external, draft({ status }))).toBe(false));
  it("managers read and create within their department, not other departments", () => {
    expect(canReadWork(manager, draft({ assignedTo: "another-officer" }))).toBe(true);
    expect(canCreateWork(manager, "internal")).toBe(true);
    expect(canReadWork(manager, draft({ area: "finance" }))).toBe(false);
    expect(canCreateWork(manager, "transport")).toBe(false);
  });
  it("forbids manager approval of their own creation", () => {
    const w = draft({ status: "Submitted", createdBy: manager.id, submittedBy: external.id });
    expect(canReviewWork(manager, w)).toBe(false);
    expect(nextApprover(w)).toBe("General Manager / another authorized approver");
    expect(canReviewWork(actorFor("General Manager"), w)).toBe(true);
  });
  it("forbids manager approval of their own submission", () => {
    const w = draft({ status: "Submitted", submittedBy: manager.id });
    expect(() => transitionWork(w, manager, "Approved")).toThrow();
  });
  it("requires a return reason and permits correction and resubmission", () => {
    const w = transitionWork(draft(), external, "Submitted");
    expect(() => transitionWork(w, manager, "Returned", "  ")).toThrow("reason");
    const returned = transitionWork(w, manager, "Returned", "Attach the port receipt");
    expect(returned.history.at(-1)?.reason).toBe("Attach the port receipt");
    expect(canEditWork(external, returned)).toBe(true);
    expect(transitionWork(returned, external, "Submitted").status).toBe("Submitted");
  });
  it("retains approval audit without changing the submitted amount", () => {
    const approved = transitionWork(transitionWork(draft({ amount: 12500 }), external, "Submitted"), manager, "Approved");
    expect(approved.amount).toBe(12500);
    expect(approved.history.map((e) => e.action)).toEqual(["Submitted", "Approved"]);
    expect(canEditWork(external, approved)).toBe(false);
  });
});