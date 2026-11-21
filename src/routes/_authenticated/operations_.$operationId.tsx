import { createFileRoute } from "@tanstack/react-router";
import { OperationDetail } from "@/features/erp/operations";
export const Route = createFileRoute("/_authenticated/operations_/$operationId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.operationId} | Rayz Freight Operation` },
      {
        name: "description",
        content: "Operation timeline, port stages, trips, finances, documents and activity.",
      },
      { property: "og:title", content: `${params.operationId} | Rayz` },
      {
        property: "og:description",
        content: "Review the complete freight operation from port to delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationPage,
});
function OperationPage() {
  const { operationId } = Route.useParams();
  return <OperationDetail id={operationId} />;
}
