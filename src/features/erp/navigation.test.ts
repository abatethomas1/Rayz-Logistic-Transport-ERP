import { describe, expect, it } from "vitest";
import { navigation, visibleSection } from "./navigation";
import {
  costDepartment,
  freightMatches,
  initialCosts,
  initialOperations,
  initialTrips,
  invoiceMatches,
  initialInvoices,
  payableMatches,
} from "./model";
describe("Navigation record rules", () => {
  it("keeps Storage linked to its port stage and operation", () => {
    const cost = initialCosts.find((c) => c.id === "BL-304");
    if (!cost) throw new Error("Missing bill");
    expect(costDepartment(cost)).toBe("external");
    expect(cost.stageId).toBe("ST-104");
    expect(cost.operationId).toBe("RZ-2026-1046");
  });
  it("treats 20ft and 40ft as container attributes", () => {
    const base = initialOperations[0];
    if (!base) throw new Error("Missing operation");
    expect(freightMatches({ ...base, type: "20ft container" }, "Containers")).toBe(true);
    expect(freightMatches({ ...base, type: "40ft container" }, "Containers")).toBe(true);
    expect(freightMatches({ ...base, type: "Machinery" }, "Containers")).toBe(false);
  });
  it("uses existing trips for status filters", () => {
    expect(initialTrips.filter((t) => t.status === "Active").map((t) => t.id)).toEqual([
      "TR-2081",
      "TR-2082",
      "TR-2084",
    ]);
  });
  it("limits owner and approval workspaces to authorized preview roles", () => {
    const owner = navigation.find((s) => s.key === "owner-dashboard");
    const approvals = navigation.find((s) => s.key === "logistics-approvals");
    if (!owner || !approvals) throw new Error("Missing section");
    expect(visibleSection("Business Owner", owner)).toBe(true);
    expect(visibleSection("Manager", approvals)).toBe(true);
    expect(visibleSection("Logistics Officer", approvals)).toBe(false);
    expect(visibleSection("Dispatcher", owner)).toBe(false);
  });
  it("scopes finance report tabs to finance preview roles", () => {
    const report = navigation.find((s) => s.key === "finance-reports");
    if (!report) throw new Error("Missing report");
    expect(visibleSection("Logistics Officer", report)).toBe(false);
    expect(visibleSection("Finance Officer", report)).toBe(true);
  });
  it("groups paid and partially paid invoices without drafts", () => {
    const invoice = initialInvoices[0];
    if (!invoice) throw new Error("Missing invoice");
    expect(invoiceMatches({ ...invoice, status: "Part-paid" }, "Paid / Partially Paid")).toBe(true);
    expect(invoiceMatches({ ...invoice, status: "Draft" }, "Paid / Partially Paid")).toBe(false);
  });
  it("does not infer payable approval from trip completion", () => {
    const trip = initialTrips[0];
    if (!trip) throw new Error("Missing trip");
    expect(payableMatches({ ...trip, cost: 100, paid: 50 }, "Partially Settled")).toBe(true);
    expect(payableMatches({ ...trip, cost: 100, paid: 100 }, "Partially Settled")).toBe(false);
    expect(payableMatches({ ...trip, status: "Completed" }, "Approved")).toBe(false);
  });
});
