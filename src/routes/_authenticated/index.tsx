import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Dashboard } from "@/features/erp/dashboard";
import { useWorkspace } from "@/features/erp/store";
import { staffLanding } from "@/features/erp/staff-landing";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Business Overview | Rayz Logistic and Transport" },
      {
        name: "description",
        content:
          "Review freight operations, port delays, active trips and financial performance in the Rayz workspace.",
      },
      { property: "og:title", content: "Rayz Logistic and Transport | Business Overview" },
      {
        property: "og:description",
        content:
          "A connected view of international freight, inland transport and operation finances.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StaffHome,
});
function StaffHome() {
  const { role } = useWorkspace();
  const landing = staffLanding(role);
  if (landing.path === '/') return <Dashboard />;
  if (landing.path === '/workspaces/$section') return <Navigate to="/workspaces/$section" params={{ section: landing.section || 'internal-logistics' }} replace />;
  return <Navigate to={landing.path} replace />;
}
