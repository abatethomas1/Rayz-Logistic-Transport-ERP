import { createFileRoute } from "@tanstack/react-router";
import { Payables } from "@/features/erp/finance";
export const Route = createFileRoute("/_authenticated/payables")({
  head: () => ({
    meta: [
      { title: "Subcontractor Payables | Rayz Logistic and Transport" },
      { name: "description", content: "Review subcontractor obligations and partial settlements." },
      { property: "og:title", content: "Subcontractor Payables | Rayz" },
      {
        property: "og:description",
        content: "Review subcontractor obligations and partial settlements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Payables,
});
