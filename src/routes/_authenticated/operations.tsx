import { createFileRoute } from "@tanstack/react-router";
import { Operations } from "@/features/erp/operations";
export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({
    meta: [
      { title: "Freight Operations | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Manage freight operations across ports and inland transport.",
      },
      { property: "og:title", content: "Freight Operations | Rayz" },
      {
        property: "og:description",
        content: "Manage freight operations across ports and inland transport.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Operations,
});
