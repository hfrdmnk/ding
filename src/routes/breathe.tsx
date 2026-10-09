import { createFileRoute } from "@tanstack/react-router";
import { ToolShell } from "../ui/ToolShell";

export const Route = createFileRoute("/breathe")({
  head: () => ({ meta: [{ title: "Box breathing · Ding" }] }),
  component: () => (
    <ToolShell title="Box breathing" accent="violet">
      <p className="text-center text-secondary">Coming soon</p>
    </ToolShell>
  ),
});
