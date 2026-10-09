import { createFileRoute } from "@tanstack/react-router";
import { ToolShell } from "../ui/ToolShell";

export const Route = createFileRoute("/today")({
  head: () => ({ meta: [{ title: "Today · Ding" }] }),
  component: () => (
    <ToolShell title="Today">
      <p className="text-center text-secondary">Coming soon</p>
    </ToolShell>
  ),
});
