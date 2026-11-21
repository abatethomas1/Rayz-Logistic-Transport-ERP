import { createFileRoute } from "@tanstack/react-router";
import { Approvals } from "@/features/erp/logistics";
export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Financial Approvals | Rayz Logistic and Transport" },
      { name: "description", content: "Review bills, approval decisions and audit history." },
      { property: "og:title", content: "Financial Approvals | Rayz" },
      {
        property: "og:description",
        content: "Review bills, approval decisions and audit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Approvals,
});
