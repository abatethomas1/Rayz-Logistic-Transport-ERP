import { createFileRoute } from "@tanstack/react-router";
import { Dispatch } from "@/features/erp/transport";
export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({
    meta: [
      { title: "Dispatch Board | Rayz Logistic and Transport" },
      { name: "description", content: "Assign trucks to ready freight and review inland trips." },
      { property: "og:title", content: "Dispatch Board | Rayz" },
      {
        property: "og:description",
        content: "Assign trucks to ready freight and review inland trips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dispatch,
});
