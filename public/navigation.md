# Rayz navigation sitemap

## Level 1: core menus
Logistics · Transport · Finance · Reports. The user confirmed the centered header with no sidebar. Freight Operations is a shared entry, not a fifth core module.

## Level 2 → Level 3
- Logistics
  - External Logistics → Port Stages, Storage, Demurrage, Port Customs Clearance, Service Charges, Documents
  - Internal Logistics → Local Customs Clearance, Government Duties, Other Government Charges, Bills & Receipts, Documents
  - Approvals → Submitted External/Internal work (Logistics Manager; General Manager escalation)
  - Logistics Overview → department summary
- Transport
  - Freight & Cargo → Containers, Bulk Cargo, Machinery, Other Freight
  - Truck Assignment → Requests, Company Trucks, Subcontractor Trucks, Assignment History
  - Trips → All, Pending, Assigned, Active, Arrived, Offloaded, Completed, Cancelled
  - Transport Approvals → Submitted Transport work (Transport Manager; General Manager escalation)
  - Transport Overview → Dispatch Board, Fleet & Partners
- Finance
  - Bills & Costs → External Logistics Bills, Internal Logistics Bills, Transport Costs, Other Costs, Cost Summary
  - Customer Invoices → All, Draft, Submitted, Issued, Paid / Partially Paid, Voided
  - Truck Rate Cards
  - Customer Payments → received invoice allocations
  - Subcontractor Payables → All, Pending, Approved, Partially Settled, Settled
  - Other Expenses
  - Receivables → All outstanding, Current, Overdue
  - Finance Approvals → Submitted Finance work (Finance Manager; General Manager escalation)
  - Finance Overview
- Reports
  - Logistics Reports → External, Internal, Costs & Delays
  - Transport Reports → Freight, Trucks, Trips & Delivery
  - Finance Reports → Revenue, Costs, Receivables, Payables, Profitability
  - Owner Dashboard (manager/owner/admin previews)

Freight Operations → operation list and customer directory. An operation opens Overview, External Logistics, Internal Logistics, Transport, Finance, Documents, Activity. Ports and container sizes remain record attributes, never navigation entries.

## Desktop sample
```text
RAYZ              Logistics  Transport  Finance  Reports             Architecture
Freight Operations > Finance                                 Search · Preview role
Bills & Costs | Customer Invoices | Truck Rate Cards | Customer Payments | …
External Logistics Bills | Internal Logistics Bills | Transport Costs | …
Operation filter · Search
Filtered records / costs / invoices
```

## Mobile sample
```text
RAYZ                                      Menu
  Logistics · Transport · Finance · Reports
Freight Operations                  Preview role
< Bills & Costs | Customer Invoices | … >
< External Bills | Internal Bills | … >
Operation filter
Search
< Scrollable records table >
```

## Context and access
Category and status tabs filter the same session-local records. Counts follow the operation/search filters. Store selections and filters in the shared session provider to restore them after client navigation; refreshing still resets the prototype. External costs always retain their operation and port-stage references. Role selection only previews visibility and controls; no authentication or backend permission enforcement is added.
## Assigned work and approvals
Department screens show scoped Draft, Submitted, Approved and Returned work, with edit/submit/delete-unused-draft actions only when allowed. Managers review their department queue, assign staff, and approve or return with a reason; they cannot approve their own creation or submission. Those requests escalate to General Manager or another authorized approver. Approved/posted records remain immutable and require auditable correction/reversal/void requests. External and Internal Officers see only their assigned Logistics area; Transport Officers/Dispatchers and Finance Officers/Accountants see their assigned work and department reports. All four core menus remain centered; restricted destinations show an access message. See architecture.md for the proposed server authorization rules.
