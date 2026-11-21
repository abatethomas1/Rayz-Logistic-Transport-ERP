import { createFileRoute } from "@tanstack/react-router";
import { Invoices } from "@/features/erp/finance";
export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Customer Invoices | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Manage customer invoices, partial payments and receivable aging.",
      },
      { property: "og:title", content: "Customer Invoices | Rayz" },
      {
        property: "og:description",
        content: "Manage customer invoices, partial payments and receivable aging.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Invoices,
});
