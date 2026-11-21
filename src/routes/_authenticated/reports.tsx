import { createFileRoute } from "@tanstack/react-router";
import { CategoryWorkspace } from "@/features/erp/category-workspace";
import { useWorkspace } from "@/features/erp/store";
import { navigation, visibleSection } from "@/features/erp/navigation";
export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Filter logistics, transport and finance reports and export records.",
      },
      { property: "og:title", content: "Reports | Rayz" },
      {
        property: "og:description",
        content: "Filter logistics, transport and finance reports and export records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});
function ReportsPage() {
  const { role } = useWorkspace();
  const section = navigation.find((s) => s.module === "Reports" && visibleSection(role, s));
  return <CategoryWorkspace section={section?.key || "logistics-reports"} />;
}
