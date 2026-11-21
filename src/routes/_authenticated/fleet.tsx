import { createFileRoute } from "@tanstack/react-router";
import { Fleet } from "@/features/erp/transport";
export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet and Partners | Rayz Logistic and Transport" },
      { name: "description", content: "Review company and subcontractor trucks and drivers." },
      { property: "og:title", content: "Fleet and Partners | Rayz" },
      {
        property: "og:description",
        content: "Review company and subcontractor trucks and drivers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Fleet,
});
