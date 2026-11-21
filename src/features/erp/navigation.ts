import { canApprove, canView, roleDepartment, type Role } from "./model";

export type CoreModule = "Logistics" | "Transport" | "Finance" | "Reports";
export type ExistingPath =
  | "/"
  | "/operations"
  | "/customers"
  | "/logistics"
  | "/transport"
  | "/trips"
  | "/fleet"
  | "/finance"
  | "/invoices"
  | "/payables"
  | "/rates"
  | "/reports"
  | "/approvals";
export type NavigationSection = {
  key: string;
  label: string;
  module: CoreModule;
  area: string;
  path?: ExistingPath;
  managersOnly?: boolean;
  tabs: string[];
};
export const navigation: NavigationSection[] = [
  {
    key: "external-logistics",
    label: "External Logistics",
    module: "Logistics",
    area: "logistics",
    path: "/logistics",
    tabs: [
      "Port Stages",
      "Storage",
      "Demurrage",
      "Port Customs Clearance",
      "Service Charges",
      "Documents",
    ],
  },
  {
    key: "internal-logistics",
    label: "Internal Logistics",
    module: "Logistics",
    area: "logistics",
    tabs: [
      "Local Customs Clearance",
      "Government Duties",
      "Other Government Charges",
      "Bills & Receipts",
      "Documents",
    ],
  },
  {
    key: "logistics-approvals",
    label: "Approvals",
    module: "Logistics",
    area: "logistics",
    managersOnly: true,
    tabs: [],
  },
  {
    key: "logistics-overview",
    label: "Logistics Overview",
    module: "Logistics",
    area: "logistics",
    tabs: [],
  },
  {
    key: "freight-cargo",
    label: "Freight & Cargo",
    module: "Transport",
    area: "transport",
    tabs: ["Containers", "Bulk Cargo", "Machinery", "Other Freight"],
  },
  {
    key: "truck-assignment",
    label: "Truck Assignment",
    module: "Transport",
    area: "transport",
    tabs: ["Requests", "Company Trucks", "Subcontractor Trucks", "Assignment History"],
  },
  {
    key: "trips",
    label: "Trips",
    module: "Transport",
    area: "transport",
    path: "/trips",
    tabs: [
      "All",
      "Pending",
      "Assigned",
      "Active",
      "Arrived",
      "Offloaded",
      "Completed",
      "Cancelled",
    ],
  },
  {
    key: "transport-approvals",
    label: "Transport Approvals",
    module: "Transport",
    area: "transport",
    managersOnly: true,
    tabs: [],
  },
  {
    key: "transport-overview",
    label: "Transport Overview",
    module: "Transport",
    area: "transport",
    path: "/transport",
    tabs: ["Dispatch Board", "Fleet & Partners"],
  },
  {
    key: "bills-costs",
    label: "Bills & Costs",
    module: "Finance",
    area: "finance",
    tabs: [
      "External Logistics Bills",
      "Internal Logistics Bills",
      "Transport Costs",
      "Other Costs",
      "Cost Summary",
    ],
  },
  {
    key: "customer-invoices",
    label: "Customer Invoices",
    module: "Finance",
    area: "finance",
    path: "/invoices",
    tabs: ["All", "Draft", "Submitted", "Issued", "Paid / Partially Paid", "Voided"],
  },
  {
    key: "truck-rates",
    label: "Truck Rate Cards",
    module: "Finance",
    area: "finance",
    path: "/rates",
    tabs: [],
  },
  {
    key: "customer-payments",
    label: "Customer Payments",
    module: "Finance",
    area: "finance",
    tabs: [],
  },
  {
    key: "subcontractor-payables",
    label: "Subcontractor Payables",
    module: "Finance",
    area: "finance",
    path: "/payables",
    tabs: ["All", "Pending", "Approved", "Partially Settled", "Settled"],
  },
  { key: "other-expenses", label: "Other Expenses", module: "Finance", area: "finance", tabs: [] },
  {
    key: "receivables",
    label: "Receivables",
    module: "Finance",
    area: "finance",
    tabs: ["All outstanding", "Current", "Overdue"],
  },
  {
    key: "finance-approvals",
    label: "Finance Approvals",
    module: "Finance",
    area: "finance",
    path: "/approvals",
    managersOnly: true,
    tabs: [],
  },
  {
    key: "finance-overview",
    label: "Finance Overview",
    module: "Finance",
    area: "finance",
    path: "/finance",
    tabs: [],
  },
  {
    key: "logistics-reports",
    label: "Logistics Reports",
    module: "Reports",
    area: "logistics",
    path: "/reports",
    tabs: ["External", "Internal", "Costs & Delays"],
  },
  {
    key: "transport-reports",
    label: "Transport Reports",
    module: "Reports",
    area: "transport",
    tabs: ["Freight", "Trucks", "Trips & Delivery"],
  },
  {
    key: "finance-reports",
    label: "Finance Reports",
    module: "Reports",
    area: "finance",
    tabs: ["Revenue", "Costs", "Receivables", "Payables", "Profitability"],
  },
  {
    key: "owner-dashboard",
    label: "Owner Dashboard",
    module: "Reports",
    area: "dashboard",
    path: "/",
    managersOnly: true,
    tabs: [],
  },
];
export function visibleSection(role: Role, section: NavigationSection) {
  if (section.managersOnly && !canApprove(role, section.area)) return false;
  if (section.key === "external-logistics" && role === "Internal Logistics Officer") return false;
  if (section.key === "internal-logistics" && ["External Logistics Officer", "Logistics Officer"].includes(role)) return false;
  if (section.module === "Reports" && roleDepartment(role) && section.area !== roleDepartment(role)) return false;
  return canView(role, section.area);
}
export function sectionForPath(path: string) {
  if (path.startsWith("/workspaces/")) return navigation.find((s) => s.key === path.split("/")[2]);
  if (path === "/fleet") return navigation.find((s) => s.key === "transport-overview");
  return navigation.find((s) => s.path === path);
}
