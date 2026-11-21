import { describe, it, expect } from "vitest";
import {
  initialOperations,
  initialStages,
  initialTrips,
  initialCosts,
  initialInvoices,
  convertedCost,
  financialSummary,
  allocatePayment,
  settleTrip,
  canWrite,
  canApprove,
} from "./model";
describe("Freight architecture rules", () => {
  it("supports Shanghai and Djibouti stages on one operation", () => {
    expect(
      initialStages.filter((s) => s.operationId === "RZ-2026-1048").map((s) => s.port),
    ).toEqual(["Shanghai", "Djibouti"]);
  });
  it("supports Djibouti-only operations", () => {
    expect(
      initialStages.filter((s) => s.operationId === "RZ-2026-1047").map((s) => s.port),
    ).toEqual(["Djibouti"]);
  });
  it("supports multiple trips with company and subcontractor trucks", () => {
    expect(
      initialTrips.filter((t) => t.operationId === "RZ-2026-1048").map((t) => t.ownership),
    ).toEqual(["Company", "Subcontractor"]);
  });
  it("preserves the transaction rate for foreign currency costs", () => {
    expect(convertedCost({ amount: 2400, rate: 132.5 })).toBe(318000);
  });
  it("computes profit as customer charges minus approved costs, not receipts", () => {
    const op = initialOperations.find((o) => o.id === "RZ-2026-1048");
    if (!op) throw new Error("Missing operation");
    const s = financialSummary(op, initialCosts, initialTrips, initialInvoices);
    expect(s.costs).toBe(1012760);
    expect(s.profit).toBe(837240);
    expect(s.received).toBe(650000);
  });
  it("excludes pending expenses from approved actual cost", () => {
    const op = initialOperations.find((o) => o.id === "RZ-2026-1047");
    if (!op) throw new Error("Missing operation");
    const s = financialSummary(op, initialCosts, initialTrips, initialInvoices);
    expect(s.pending).toBe(113220);
    expect(s.costs).toBe(0);
  });
  it("does not require all stage work to finish before dispatching cleared freight", () => {
    expect(initialStages.find((s) => s.id === "ST-106")?.status).toBe("In clearance");
    expect(initialOperations.find((o) => o.id === "RZ-2026-1045")?.ready).toBe(true);
    expect(initialTrips.filter((t) => t.operationId === "RZ-2026-1045").length).toBe(2);
  });
  it("records partial customer payment without overwriting prior receipts", () => {
    const i = initialInvoices.find((x) => x.id === "INV-2026-081");
    if (!i) throw new Error("Missing invoice");
    expect(allocatePayment(i, 250000)).toMatchObject({ paid: 900000, status: "Part-paid" });
    expect(i.paid).toBe(650000);
  });
  it("marks full payment paid and rejects overpayment", () => {
    const i = initialInvoices.find((x) => x.id === "INV-2026-080");
    if (!i) throw new Error("Missing invoice");
    expect(allocatePayment(i, 600000).status).toBe("Paid");
    expect(() => allocatePayment(i, 600001)).toThrow();
    expect(() => allocatePayment(i, 0)).toThrow();
  });
  it("supports partial subcontractor settlements", () => {
    const t = initialTrips.find((x) => x.id === "TR-2082");
    if (!t) throw new Error("Missing trip");
    expect(settleTrip(t, 50000).paid).toBe(150000);
    expect(() => settleTrip(t, 145001)).toThrow();
  });
  it("limits operational and financial write controls by role", () => {
    expect(canWrite("Dispatcher", "transport")).toBe(true);
    expect(canWrite("Dispatcher", "finance")).toBe(false);
    expect(canWrite("Finance Officer", "finance")).toBe(true);
    expect(canApprove("Business Owner")).toBe(true);
    expect(canApprove("Logistics Officer")).toBe(false);
  });
});
