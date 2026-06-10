import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// A small "what's running this" card. The environment label comes from NEXT_PUBLIC_APP_ENV
// (set per environment in Vercel, "local" in dev); the rest name the platform pieces the app
// is built on. "AI Gateway" rather than a raw provider — see decision D4.
export function DeploymentStatusCard() {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Vercel runtime</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{process.env.NEXT_PUBLIC_APP_ENV ?? "local"}</Badge>
        <Badge>Functions + Fluid Compute</Badge>
        <Badge>Neon Postgres</Badge>
        <Badge>AI Gateway</Badge>
      </div>
    </Card>
  );
}
