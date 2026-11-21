import { createFileRoute } from "@tanstack/react-router";
import { Customers } from "@/features/erp/directory-reports";
export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Review customer contacts, freight activity and outstanding balances.",
      },
      { property: "og:title", content: "Customers | Rayz" },
      {
        property: "og:description",
        content: "Review customer contacts, freight activity and outstanding balances.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Customers,
});
