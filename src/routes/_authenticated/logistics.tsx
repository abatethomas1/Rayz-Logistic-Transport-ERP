import { createFileRoute } from "@tanstack/react-router";
import { Logistics } from "@/features/erp/logistics";
export const Route = createFileRoute("/_authenticated/logistics")({
  head: () => ({
    meta: [
      { title: "Port Logistics | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Review multi-port handling stages, bills and logistics charges.",
      },
      { property: "og:title", content: "Port Logistics | Rayz" },
      {
        property: "og:description",
        content: "Review multi-port handling stages, bills and logistics charges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Logistics,
});
