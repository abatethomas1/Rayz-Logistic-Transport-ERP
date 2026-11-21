import { createFileRoute } from "@tanstack/react-router";
import { Rates } from "@/features/erp/finance";
export const Route = createFileRoute("/_authenticated/rates")({
  head: () => ({
    meta: [
      { title: "Truck Rate Cards | Rayz Logistic and Transport" },
      { name: "description", content: "Review separate company and subcontractor rate cards." },
      { property: "og:title", content: "Truck Rate Cards | Rayz" },
      {
        property: "og:description",
        content: "Review separate company and subcontractor rate cards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rates,
});
