import { createFileRoute } from "@tanstack/react-router";
import { Finance } from "@/features/erp/finance";
export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Financial Overview | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Review operation charges, approved costs and estimated profit.",
      },
      { property: "og:title", content: "Financial Overview | Rayz" },
      {
        property: "og:description",
        content: "Review operation charges, approved costs and estimated profit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Finance,
});
