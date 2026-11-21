import { createFileRoute } from "@tanstack/react-router";
import { Trips } from "@/features/erp/transport";
export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({
    meta: [
      { title: "Transport Trips | Rayz Logistic and Transport" },
      {
        name: "description",
        content: "Track truck trips, delivery milestones and proof of delivery.",
      },
      { property: "og:title", content: "Transport Trips | Rayz" },
      {
        property: "og:description",
        content: "Track truck trips, delivery milestones and proof of delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Trips,
});
