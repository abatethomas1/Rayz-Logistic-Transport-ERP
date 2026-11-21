export const roles = [
  "Business Owner", "General Manager", "Logistics Manager", "Transport Manager", "Finance Manager",
  "External Logistics Officer", "Internal Logistics Officer", "Transport Officer", "Dispatcher",
  "Finance Officer", "Accountant", "Admin",
] as const;
export type Role = (typeof roles)[number] | "Manager" | "Logistics Officer";
export type Operation = {
  id: string;
  customer: string;
  origin: string;
  destination: string;
  type: string;
  quantity: number;
  weight: number;
  containers: string[];
  status: string;
  opened: string;
  due: string;
  charge: number;
  progress: number;
  ready: boolean;
  blocker: string;
};
export type Stage = {
  id: string;
  operationId: string;
  port: string;
  country: string;
  status: string;
  arrival: string;
  release: string;
  owner: string;
};
export type Trip = {
  id: string;
  operationId: string;
  truck: string;
  driver: string;
  ownership: "Company" | "Subcontractor";
  supplier: string;
  status: string;
  departure: string;
  arrival: string;
  freight: string;
  charge: number;
  cost: number;
  paid: number;
  pod: string;
};
export type Cost = {
  id: string;
  operationId: string;
  stageId: string;
  category: string;
  supplier: string;
  currency: string;
  amount: number;
  rate: number;
  approval: string;
  status: string;
  date: string;
  convertedAmount?: number;
};
export type Invoice = {
  id: string;
  operationId: string;
  amount: number;
  paid: number;
  due: string;
  issued: string;
  status: string;
};
export type Activity = {
  id: string;
  operationId: string;
  text: string;
  actor: string;
  time: string;
};
export type Doc = { id: string; operationId: string; name: string; date: string; category: string };
export type Customer = {
  name: string;
  initials: string;
  contact: string;
  email: string;
  phone: string;
  industry: string;
  terms: string;
};
export const customers: Customer[] = [
  {
    name: "Ethio Steel PLC",
    initials: "ES",
    contact: "Dawit Mekonnen",
    email: "operations@ethiosteel.example",
    phone: "+251 911 240 810",
    industry: "Manufacturing",
    terms: "30 days",
  },
  {
    name: "Habesha Construction",
    initials: "HC",
    contact: "Hana Tesfaye",
    email: "logistics@habesha.example",
    phone: "+251 911 380 422",
    industry: "Construction",
    terms: "30 days",
  },
  {
    name: "Awash Agro Industries",
    initials: "AA",
    contact: "Abel Girma",
    email: "supply@awashagro.example",
    phone: "+251 912 110 760",
    industry: "Agriculture",
    terms: "15 days",
  },
  {
    name: "Bole Trading PLC",
    initials: "BT",
    contact: "Selam Abebe",
    email: "imports@boletrading.example",
    phone: "+251 913 050 300",
    industry: "Import & distribution",
    terms: "30 days",
  },
  {
    name: "East Africa Machinery",
    initials: "EM",
    contact: "Yonas Bekele",
    email: "freight@eamachinery.example",
    phone: "+251 911 332 010",
    industry: "Heavy equipment",
    terms: "15 days",
  },
];
export const initialOperations: Operation[] = [
  {
    id: "RZ-2026-1048",
    customer: "Ethio Steel PLC",
    origin: "Shanghai, China",
    destination: "Addis Ababa",
    type: "40ft container",
    quantity: 4,
    weight: 84000,
    containers: ["MSCU 729104 6", "MSCU 729105 1", "TCLU 483920 7", "TCLU 483921 2"],
    status: "In transit",
    opened: "2026-11-02",
    due: "2026-11-24",
    charge: 1850000,
    progress: 68,
    ready: true,
    blocker: "",
  },
  {
    id: "RZ-2026-1047",
    customer: "Habesha Construction",
    origin: "Djibouti",
    destination: "Adama",
    type: "Bulk cargo",
    quantity: 3,
    weight: 72000,
    containers: [],
    status: "At port",
    opened: "2026-11-08",
    due: "2026-11-22",
    charge: 980000,
    progress: 35,
    ready: false,
    blocker: "Customs release pending",
  },
  {
    id: "RZ-2026-1046",
    customer: "Awash Agro Industries",
    origin: "Djibouti",
    destination: "Bishoftu",
    type: "20ft container",
    quantity: 2,
    weight: 36000,
    containers: ["CMAU 380110 8", "CMAU 380111 3"],
    status: "Ready for dispatch",
    opened: "2026-11-10",
    due: "2026-11-23",
    charge: 720000,
    progress: 48,
    ready: true,
    blocker: "",
  },
  {
    id: "RZ-2026-1045",
    customer: "Bole Trading PLC",
    origin: "Ningbo, China",
    destination: "Addis Ababa",
    type: "40ft container",
    quantity: 6,
    weight: 126000,
    containers: ["OOLU 602190 3", "OOLU 602191 8"],
    status: "In transit",
    opened: "2026-11-01",
    due: "2026-11-25",
    charge: 2450000,
    progress: 76,
    ready: true,
    blocker: "2 of 6 containers await customs release",
  },
  {
    id: "RZ-2026-1044",
    customer: "East Africa Machinery",
    origin: "Djibouti",
    destination: "Hawassa",
    type: "Machinery",
    quantity: 1,
    weight: 28500,
    containers: [],
    status: "Delivered",
    opened: "2026-10-28",
    due: "2026-11-17",
    charge: 1150000,
    progress: 100,
    ready: true,
    blocker: "",
  },
  {
    id: "RZ-2026-1043",
    customer: "Ethio Steel PLC",
    origin: "Djibouti",
    destination: "Addis Ababa",
    type: "20ft container",
    quantity: 3,
    weight: 54000,
    containers: ["MSCU 520801 1"],
    status: "On hold",
    opened: "2026-11-12",
    due: "2026-11-26",
    charge: 890000,
    progress: 25,
    ready: false,
    blocker: "Original bill of lading required",
  },
];
export const initialStages: Stage[] = [
  {
    id: "ST-101",
    operationId: "RZ-2026-1048",
    port: "Shanghai",
    country: "China",
    status: "Released",
    arrival: "2026-11-03",
    release: "2026-11-07",
    owner: "Li Wei",
  },
  {
    id: "ST-102",
    operationId: "RZ-2026-1048",
    port: "Djibouti",
    country: "Djibouti",
    status: "Released",
    arrival: "2026-11-14",
    release: "2026-11-18",
    owner: "Meron Tadesse",
  },
  {
    id: "ST-103",
    operationId: "RZ-2026-1047",
    port: "Djibouti",
    country: "Djibouti",
    status: "Delayed",
    arrival: "2026-11-12",
    release: "2026-11-20",
    owner: "Meron Tadesse",
  },
  {
    id: "ST-104",
    operationId: "RZ-2026-1046",
    port: "Djibouti",
    country: "Djibouti",
    status: "Released",
    arrival: "2026-11-14",
    release: "2026-11-19",
    owner: "Abel Girma",
  },
  {
    id: "ST-105",
    operationId: "RZ-2026-1045",
    port: "Ningbo",
    country: "China",
    status: "Released",
    arrival: "2026-11-02",
    release: "2026-11-05",
    owner: "Li Wei",
  },
  {
    id: "ST-106",
    operationId: "RZ-2026-1045",
    port: "Djibouti",
    country: "Djibouti",
    status: "In clearance",
    arrival: "2026-11-13",
    release: "2026-11-22",
    owner: "Meron Tadesse",
  },
  {
    id: "ST-107",
    operationId: "RZ-2026-1044",
    port: "Djibouti",
    country: "Djibouti",
    status: "Released",
    arrival: "2026-11-03",
    release: "2026-11-06",
    owner: "Meron Tadesse",
  },
  {
    id: "ST-108",
    operationId: "RZ-2026-1043",
    port: "Djibouti",
    country: "Djibouti",
    status: "On hold",
    arrival: "2026-11-16",
    release: "2026-11-24",
    owner: "Abel Girma",
  },
];
export const fleet = [
  {
    truck: "AA 3-48219",
    driver: "Tesfaye Bekele",
    ownership: "Company" as const,
    supplier: "Rayz fleet",
    capacity: 30000,
    trailer: "TR-091",
  },
  {
    truck: "AA 3-51082",
    driver: "Abebe Alemu",
    ownership: "Company" as const,
    supplier: "Rayz fleet",
    capacity: 32000,
    trailer: "TR-104",
  },
  {
    truck: "OR 3-29410",
    driver: "Mohammed Ali",
    ownership: "Subcontractor" as const,
    supplier: "Red Sea Transport",
    capacity: 30000,
    trailer: "RS-012",
  },
  {
    truck: "AA 3-61205",
    driver: "Dawit Hailu",
    ownership: "Subcontractor" as const,
    supplier: "Highland Haulage",
    capacity: 40000,
    trailer: "HH-008",
  },
  {
    truck: "AA 3-49807",
    driver: "Girma Tadesse",
    ownership: "Company" as const,
    supplier: "Rayz fleet",
    capacity: 30000,
    trailer: "TR-112",
  },
];
export const initialTrips: Trip[] = [
  {
    id: "TR-2081",
    operationId: "RZ-2026-1048",
    truck: "AA 3-48219",
    driver: "Tesfaye Bekele",
    ownership: "Company",
    supplier: "Rayz fleet",
    status: "Active",
    departure: "2026-11-19",
    arrival: "2026-11-22",
    freight: "MSCU 729104 6",
    charge: 340000,
    cost: 210000,
    paid: 210000,
    pod: "",
  },
  {
    id: "TR-2082",
    operationId: "RZ-2026-1048",
    truck: "OR 3-29410",
    driver: "Mohammed Ali",
    ownership: "Subcontractor",
    supplier: "Red Sea Transport",
    status: "Active",
    departure: "2026-11-19",
    arrival: "2026-11-22",
    freight: "MSCU 729105 1",
    charge: 340000,
    cost: 245000,
    paid: 100000,
    pod: "",
  },
  {
    id: "TR-2083",
    operationId: "RZ-2026-1045",
    truck: "AA 3-51082",
    driver: "Abebe Alemu",
    ownership: "Company",
    supplier: "Rayz fleet",
    status: "Arrived",
    departure: "2026-11-17",
    arrival: "2026-11-20",
    freight: "OOLU 602190 3",
    charge: 350000,
    cost: 205000,
    paid: 205000,
    pod: "",
  },
  {
    id: "TR-2084",
    operationId: "RZ-2026-1045",
    truck: "AA 3-61205",
    driver: "Dawit Hailu",
    ownership: "Subcontractor",
    supplier: "Highland Haulage",
    status: "Active",
    departure: "2026-11-18",
    arrival: "2026-11-21",
    freight: "OOLU 602191 8",
    charge: 350000,
    cost: 255000,
    paid: 0,
    pod: "",
  },
  {
    id: "TR-2078",
    operationId: "RZ-2026-1044",
    truck: "AA 3-49807",
    driver: "Girma Tadesse",
    ownership: "Company",
    supplier: "Rayz fleet",
    status: "Completed",
    departure: "2026-11-12",
    arrival: "2026-11-15",
    freight: "Industrial excavator · 28.5t",
    charge: 650000,
    cost: 410000,
    paid: 410000,
    pod: "Signed delivery receipt.pdf",
  },
];
export const initialCosts: Cost[] = [
  {
    id: "BL-301",
    operationId: "RZ-2026-1048",
    stageId: "ST-101",
    category: "Port handling",
    supplier: "Shanghai Port Services",
    currency: "USD",
    amount: 2400,
    rate: 132.5,
    approval: "Approved",
    status: "Paid",
    date: "2026-11-07",
  },
  {
    id: "BL-302",
    operationId: "RZ-2026-1048",
    stageId: "ST-102",
    category: "Customs clearance",
    supplier: "Djibouti Customs Agent",
    currency: "USD",
    amount: 1800,
    rate: 133.2,
    approval: "Approved",
    status: "Unpaid",
    date: "2026-11-18",
  },
  {
    id: "BL-303",
    operationId: "RZ-2026-1047",
    stageId: "ST-103",
    category: "Demurrage",
    supplier: "Doraleh Terminal",
    currency: "USD",
    amount: 850,
    rate: 133.2,
    approval: "Pending",
    status: "Unpaid",
    date: "2026-11-19",
  },
  {
    id: "BL-304",
    operationId: "RZ-2026-1046",
    stageId: "ST-104",
    category: "Storage",
    supplier: "Doraleh Terminal",
    currency: "USD",
    amount: 620,
    rate: 133.2,
    approval: "Approved",
    status: "Paid",
    date: "2026-11-18",
  },
  {
    id: "BL-305",
    operationId: "RZ-2026-1045",
    stageId: "ST-105",
    category: "Port handling",
    supplier: "Ningbo Port Services",
    currency: "CNY",
    amount: 14500,
    rate: 18.6,
    approval: "Approved",
    status: "Paid",
    date: "2026-11-05",
  },
  {
    id: "BL-306",
    operationId: "RZ-2026-1045",
    stageId: "ST-106",
    category: "Customs clearance",
    supplier: "Djibouti Customs Agent",
    currency: "USD",
    amount: 2200,
    rate: 133.2,
    approval: "Pending",
    status: "Unpaid",
    date: "2026-11-19",
  },
  {
    id: "BL-307",
    operationId: "RZ-2026-1044",
    stageId: "ST-107",
    category: "Service charges",
    supplier: "Doraleh Terminal",
    currency: "ETB",
    amount: 185000,
    rate: 1,
    approval: "Approved",
    status: "Paid",
    date: "2026-11-07",
  },
  {
    id: "BL-308",
    operationId: "RZ-2026-1043",
    stageId: "ST-108",
    category: "Storage",
    supplier: "Doraleh Terminal",
    currency: "USD",
    amount: 490,
    rate: 133.2,
    approval: "Pending",
    status: "Unpaid",
    date: "2026-11-20",
  },
];
export const initialInvoices: Invoice[] = [
  {
    id: "INV-2026-081",
    operationId: "RZ-2026-1048",
    amount: 1500000,
    paid: 650000,
    due: "2026-11-28",
    issued: "2026-11-01",
    status: "Part-paid",
  },
  {
    id: "INV-2026-080",
    operationId: "RZ-2026-1047",
    amount: 600000,
    paid: 0,
    due: "2026-11-18",
    issued: "2026-10-19",
    status: "Issued",
  },
  {
    id: "INV-2026-079",
    operationId: "RZ-2026-1045",
    amount: 2000000,
    paid: 800000,
    due: "2026-11-24",
    issued: "2026-10-25",
    status: "Part-paid",
  },
  {
    id: "INV-2026-078",
    operationId: "RZ-2026-1044",
    amount: 1150000,
    paid: 1150000,
    due: "2026-11-15",
    issued: "2026-10-16",
    status: "Paid",
  },
];
export const initialDocs: Doc[] = [
  {
    id: "DOC-1",
    operationId: "RZ-2026-1048",
    name: "Bill of lading — MSCU.pdf",
    date: "2026-11-03",
    category: "Shipping",
  },
  {
    id: "DOC-2",
    operationId: "RZ-2026-1048",
    name: "Djibouti customs release.pdf",
    date: "2026-11-18",
    category: "Customs",
  },
];
export const initialActivity: Activity[] = [
  {
    id: "A-1",
    operationId: "RZ-2026-1048",
    text: "TR-2082 departed Djibouti with MSCU 729105 1",
    actor: "Dispatcher · Abebe",
    time: "20 Nov 2026 · 08:40",
  },
  {
    id: "A-2",
    operationId: "RZ-2026-1048",
    text: "Djibouti stage released for four containers",
    actor: "Logistics · Meron",
    time: "18 Nov 2026 · 14:20",
  },
  {
    id: "A-3",
    operationId: "RZ-2026-1048",
    text: "ETB 650,000 payment allocated to INV-2026-081",
    actor: "Finance · Selam",
    time: "17 Nov 2026 · 10:15",
  },
];
export const tripStates = [
  "Pending",
  "Assigned",
  "Active",
  "Arrived",
  "Offloaded",
  "Completed",
  "Cancelled",
];
export function roleDepartment(role: Role): "logistics" | "transport" | "finance" | null {
  if (["Logistics Manager", "External Logistics Officer", "Internal Logistics Officer", "Logistics Officer"].includes(role)) return "logistics";
  if (["Transport Manager", "Transport Officer", "Dispatcher"].includes(role)) return "transport";
  if (["Finance Manager", "Finance Officer", "Accountant"].includes(role)) return "finance";
  return null;
}
export function canWrite(role: Role, area: string) {
  if (["General Manager", "Manager", "Business Owner"].includes(role)) return true;
  if (role === "Admin") return false;
  if (area === "operations") return false;
  return roleDepartment(role) === area;
}
export function canApprove(role: Role, area?: string) {
  if (["General Manager", "Manager", "Business Owner"].includes(role)) return true;
  return role.endsWith("Manager") && (!area || roleDepartment(role) === area);
}
export function canView(role: Role, area: string) {
  if (["Admin", "General Manager", "Manager", "Business Owner"].includes(role)) return true;
  if (area === "operations") return true;
  if (area === "dashboard") return false;
  return roleDepartment(role) === area;
}
export function convertedCost(cost: Pick<Cost, "amount" | "rate" | "convertedAmount">) {
  return cost.convertedAmount ?? Math.round(cost.amount * cost.rate * 100) / 100;
}
export function costDepartment(cost: Cost): "external" | "internal" | "transport" | "other" {
  if (cost.stageId) return "external";
  if (/transport|truck|fuel|driver/i.test(cost.category)) return "transport";
  if (/customs|government|duties|duty|local clearance/i.test(cost.category)) return "internal";
  return "other";
}
export function freightMatches(op: Operation, tab: string) {
  if (tab === "Containers") return /container/i.test(op.type);
  if (tab === "Bulk Cargo") return /bulk/i.test(op.type);
  if (tab === "Machinery") return /machinery/i.test(op.type);
  return !/container|bulk|machinery/i.test(op.type);
}
export function invoiceMatches(invoice: Invoice, tab: string) {
  if (tab === "All") return true;
  if (tab === "Paid / Partially Paid") return ["Paid", "Part-paid"].includes(invoice.status);
  return invoice.status === tab;
}
export function payableMatches(trip: Trip, tab: string) {
  if (tab === "All") return true;
  if (tab === "Settled") return trip.paid === trip.cost;
  if (tab === "Partially Settled") return trip.paid > 0 && trip.paid < trip.cost;
  if (tab === "Pending") return trip.paid === 0;
  // No payable approval records exist; trip progress must never imply approval.
  return false;
}
export function financialSummary(op: Operation, costs: Cost[], trips: Trip[], invoices: Invoice[]) {
  const bills = costs.filter((c) => c.operationId === op.id);
  const ts = trips.filter((t) => t.operationId === op.id && t.status !== "Cancelled");
  const inv = invoices.filter((i) => i.operationId === op.id);
  const approvedCosts =
    bills.filter((c) => c.approval === "Approved").reduce((s, c) => s + convertedCost(c), 0) +
    ts.reduce((s, t) => s + t.cost, 0);
  return {
    revenue: op.charge,
    costs: approvedCosts,
    pending: bills
      .filter((c) => c.approval === "Pending")
      .reduce((s, c) => s + convertedCost(c), 0),
    profit: op.charge - approvedCosts,
    invoiced: inv.reduce((s, i) => s + i.amount, 0),
    received: inv.reduce((s, i) => s + i.paid, 0),
    payables:
      bills
        .filter((c) => c.approval === "Approved" && c.status !== "Paid")
        .reduce((s, c) => s + convertedCost(c), 0) +
      ts.filter((t) => t.ownership === "Subcontractor").reduce((s, t) => s + t.cost - t.paid, 0),
  };
}
export function allocatePayment(invoice: Invoice, amount: number): Invoice {
  if (!Number.isFinite(amount) || amount <= 0 || amount > invoice.amount - invoice.paid)
    throw new Error("Enter an amount above zero and no greater than the outstanding balance.");
  const paid = invoice.paid + amount;
  return { ...invoice, paid, status: paid === invoice.amount ? "Paid" : "Part-paid" };
}
export function settleTrip(trip: Trip, amount: number): Trip {
  if (!Number.isFinite(amount) || amount <= 0 || amount > trip.cost - trip.paid)
    throw new Error("Enter an amount above zero and no greater than the payable balance.");
  return { ...trip, paid: trip.paid + amount };
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const shortMoney = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : `${(n / 1000).toFixed(0)}K`;
export const dateLabel = (s: string) =>
  new Date(`${s}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const ageDays = (due: string) =>
  Math.max(0, Math.floor((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(due)) / 86400000));
