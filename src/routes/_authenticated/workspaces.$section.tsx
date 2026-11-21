import { createFileRoute } from "@tanstack/react-router";
import { CategoryWorkspace } from "@/features/erp/category-workspace";
import { navigation } from "@/features/erp/navigation";
export const Route = createFileRoute("/_authenticated/workspaces/$section")({
  head: ({ params }) => {
    const label = navigation.find((s) => s.key === params.section)?.label || "Workspace";
    const description = `${label} records and operation-linked views for Rayz Logistic and Transport.`;
    return {
      meta: [
        { title: `${label} | Rayz Logistic and Transport` },
        { name: "description", content: description },
        { property: "og:title", content: `${label} | Rayz` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: WorkspacePage,
});
function WorkspacePage() {
  const { section } = Route.useParams();
  return <CategoryWorkspace key={section} section={section} />;
}
