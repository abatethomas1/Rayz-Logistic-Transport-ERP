import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Package,
  Truck,
  Wallet,
  TrendingUp,
  CalendarDays,
  Plus,
  ArrowUpRight,
  Clock,
  TriangleAlert,
  Receipt,
  Anchor,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import port from "@/assets/freight-port.asset.json";
import { PageHeader, SectionHeading, Stat, OperationTable, Button } from "./ui";
import { useWorkspace } from "./store";
import { shortMoney, money, financialSummary, canWrite } from "./model";
import { CreateOperation } from "./operations";
import { PermissionGate } from "./shell";
export function Dashboard() {
  const { operations, trips, costs, invoices, role } = useWorkspace();
  const [create, setCreate] = useState(false);
  const [period, setPeriod] = useState("This month");
  const open = operations.filter((o) => o.status !== "Delivered");
  const active = trips.filter((t) => t.status === "Active");
  const summaries = operations.map((o) => financialSummary(o, costs, trips, invoices));
  const revenue = summaries.reduce((s, x) => s + x.revenue, 0);
  const totalCost = summaries.reduce((s, x) => s + x.costs, 0);
  const unpaid = invoices.reduce((s, i) => s + i.amount - i.paid, 0);
  const pending = costs.filter((c) => c.approval === "Pending").length;
  const subset =
    period === "This week" ? operations.filter((o) => o.opened >= "2026-11-10") : operations;
  return (
    <PermissionGate area="dashboard">
      <PageHeader
        title="Business overview"
        description="A clear view of your operations, performance, and what needs attention."
      >
        <div className="date-filter">
          <CalendarDays size={14} />
          <select
            aria-label="Dashboard period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>This month</option>
            <option>This week</option>
          </select>
          <span>Nov 2026</span>
        </div>
        {canWrite(role, "operations") ? (
          <Button onClick={() => setCreate(true)}>
            <Plus />
            Create operation
          </Button>
        ) : (
          <Button asChild>
            <Link to="/operations">
              <Package />
              View operations
            </Link>
          </Button>
        )}
      </PageHeader>
      <div className="stats-grid">
        <Stat
          label="Operations in progress"
          value={String(open.length)}
          detail="Across 3 port locations"
          icon={<Package />}
          href="/operations"
        />
        <Stat
          label="Active trips"
          value={String(active.length)}
          detail={`${trips.filter((t) => t.status === "Arrived").length} arrived · awaiting offload`}
          icon={<Truck />}
          href="/transport"
        />
        <Stat
          label="Outstanding receivables"
          value={shortMoney(unpaid)}
          unit="ETB"
          detail="1 invoice overdue"
          positive={false}
          icon={<Wallet />}
          href="/invoices"
        />
        <Stat
          label="Estimated profit"
          value={shortMoney(revenue - totalCost)}
          unit="ETB"
          detail={`${(((revenue - totalCost) / revenue) * 100).toFixed(1)}% estimated margin`}
          icon={<TrendingUp />}
          href="/finance"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <SectionHeading
            title="Revenue & costs"
            description="Customer charges and approved actual costs"
          >
            <select
              aria-label="Chart period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option>This month</option>
              <option>This week</option>
            </select>
          </SectionHeading>
          <div className="chart-body">
            <div className="chart-summary">
              <div>
                <small>Total customer charges</small>
                <strong>
                  {shortMoney(revenue)}
                  <span>ETB</span>
                </strong>
              </div>
              <div>
                <small>Approved actual costs</small>
                <strong>
                  {shortMoney(totalCost)}
                  <span>ETB</span>
                </strong>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-dot" />
                  Revenue
                </span>
                <span>
                  <i className="legend-dot cost" />
                  Costs
                </span>
              </div>
            </div>
            <RevenueChart week={period === "This week"} />
          </div>
        </section>
        <section className="panel">
          <SectionHeading title="Needs attention">
            <span className="attention-count">{pending + 2} items</span>
          </SectionHeading>
          <div className="attention-list">
            <Link to="/logistics" className="attention-item">
              <div className="attention-icon danger">
                <TriangleAlert size={16} />
              </div>
              <div>
                <h3>Port clearance is delayed</h3>
                <p>Habesha Construction · Djibouti port</p>
                <p>RZ-2026-1047 · expected 20 Nov</p>
              </div>
              <ChevronRight className="arrow" size={15} />
            </Link>
            <Link to="/approvals" className="attention-item">
              <div className="attention-icon">
                <Receipt size={16} />
              </div>
              <div>
                <h3>{pending} expenses awaiting approval</h3>
                <p>Port bills and customs charges</p>
                <p>Review before payment</p>
              </div>
              <ChevronRight className="arrow" size={15} />
            </Link>
            <Link to="/payables" className="attention-item">
              <div className="attention-icon info">
                <Truck size={16} />
              </div>
              <div>
                <h3>Subcontractor payments coming up</h3>
                <p>Red Sea Transport · Highland Haulage</p>
                <p>
                  ETB{" "}
                  {money(
                    trips
                      .filter((t) => t.ownership === "Subcontractor")
                      .reduce((s, t) => s + t.cost - t.paid, 0),
                  )}{" "}
                  outstanding
                </p>
              </div>
              <ChevronRight className="arrow" size={15} />
            </Link>
          </div>
          <Link to="/approvals" className="attention-footer">
            <CheckCheck size={13} />
            View approval queue
            <ArrowUpRight size={12} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="Recent freight operations"
          description="Follow every shipment from port to delivery"
        >
          <Button asChild variant="ghost" size="sm">
            <Link to="/operations">
              View all operations
              <ArrowUpRight />
            </Link>
          </Button>
        </SectionHeading>
        <OperationTable rows={subset.slice(0, 5)} compact />
        <div className="table-footer">
          <span>
            Showing {Math.min(subset.length, 5)} of {subset.length} operations
          </span>
          <span>Updated in this session</span>
        </div>
      </section>
      <div className="lower-grid">
        <section className="panel">
          <SectionHeading
            title="Inland transport network"
            description={`Djibouti corridor · ${active.length} active trips`}
          >
            <Button asChild variant="ghost" size="sm">
              <Link to="/transport">
                Live dispatch
                <ArrowUpRight />
              </Link>
            </Button>
          </SectionHeading>
          <div className="route-map">
            <RouteMap />
            <span className="map-legend">
              <i className="legend-dot" /> Active transport corridor
            </span>
          </div>
        </section>
        <section className="panel port-card">
          <img
            src={port.url}
            alt="Container terminal and cargo ship at an illustrative international port"
          />
          <div className="port-caption">
            <span className="port-status">
              <Anchor size={12} />
              PORT OPERATIONS
            </span>
            <h2>Across borders. In one view.</h2>
            <p>
              Shanghai, Ningbo and Djibouti
              <br />
              connected to your inland operations.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/logistics">
                View port stages
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </section>
      </div>
      <CreateOperation open={create} onClose={() => setCreate(false)} />
    </PermissionGate>
  );
}
function RevenueChart({ week }: { week: boolean }) {
  return (
    <svg
      className="chart-svg"
      viewBox="0 0 650 200"
      role="img"
      aria-label="Illustrative cumulative revenue and cost trend in November 2026"
    >
      {[20, 60, 100, 140, 180].map((y, i) => (
        <g key={y}>
          <line className="chart-grid" x1="42" y1={y} x2="632" y2={y} />
          <text x="3" y={y + 3}>
            {[8, 6, 4, 2, 0][i]}M
          </text>
        </g>
      ))}
      <path
        className="revenue-fill"
        d={
          week
            ? "M42 135 L140 122 L238 115 L336 78 L434 70 L532 42 L630 28 L630 180 L42 180Z"
            : "M42 158 C85 156 95 142 140 145 S190 122 238 127 S285 95 336 102 S380 76 434 83 S482 45 532 52 S580 28 630 23 L630 180 L42 180Z"
        }
      />
      <path
        className="revenue-line"
        d={
          week
            ? "M42 135 L140 122 L238 115 L336 78 L434 70 L532 42 L630 28"
            : "M42 158 C85 156 95 142 140 145 S190 122 238 127 S285 95 336 102 S380 76 434 83 S482 45 532 52 S580 28 630 23"
        }
      />
      <path
        className="cost-line"
        d="M42 171 C90 168 103 162 140 164 S200 149 238 153 S292 137 336 140 S390 125 434 128 S485 116 532 116 S580 108 630 103"
      />
      {[42, 140, 238, 336, 434, 532, 630].map((x, i) => (
        <text key={x} x={x} y="199" textAnchor="middle">
          {week
            ? `${14 + i} Nov`
            : ["1 Nov", "5 Nov", "9 Nov", "13 Nov", "17 Nov", "21 Nov", "25 Nov"][i]}
        </text>
      ))}
    </svg>
  );
}
function RouteMap() {
  return (
    <svg
      viewBox="0 0 640 230"
      aria-label="Illustrative route from Djibouti to Addis Ababa, Adama and Bishoftu"
      role="img"
    >
      <path
        className="map-land"
        d="M0 0H454L473 37 487 51 496 70 490 100 517 122 540 147 588 169 640 168V230H0Z"
      />
      <path
        className="map-land"
        d="M67 0L98 45 158 55 175 101 142 141 166 230M158 55L232 39 299 81 304 135 380 160 423 230M299 81L381 58 443 89 490 100M304 135L269 188 275 230M380 160L438 147 484 179 514 230"
        fill="none"
      />
      <text className="map-secondary" x="255" y="42">
        ETHIOPIA
      </text>
      <text className="map-secondary" x="485" y="38">
        GULF OF ADEN
      </text>
      <path className="map-route" d="M455 84 Q352 114 253 150 L275 176 M253 150L311 188" />
      <circle className="map-dot" cx="455" cy="84" r="6" />
      <circle className="map-dot" cx="253" cy="150" r="6" />
      <circle className="map-dot" cx="275" cy="176" r="4" />
      <circle className="map-dot" cx="311" cy="188" r="4" />
      <text className="map-label" x="470" y="81">
        Djibouti
      </text>
      <text className="map-label" x="159" y="148">
        Addis Ababa
      </text>
      <text className="map-secondary" x="218" y="191">
        Bishoftu
      </text>
      <text className="map-secondary" x="321" y="193">
        Adama
      </text>
      <text className="map-secondary" x="342" y="108">
        910 km
      </text>
    </svg>
  );
}
