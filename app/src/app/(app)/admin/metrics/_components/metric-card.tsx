import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  series?: Array<{ day: string; count: number }>;
  pending?: boolean;
}

/**
 * Plain server-renderable metric card with an inline SVG sparkline.
 * Avoids pulling a chart library — at 14 daily points an `<svg>` polyline
 * is more than enough, has zero runtime cost, and trivially server-renders.
 */
export function MetricCard({ label, value, hint, series, pending }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">
          {pending ? <span className="text-muted-foreground">—</span> : value}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {series && series.length > 1 && <Sparkline series={series} />}
      </CardContent>
    </Card>
  );
}

function Sparkline({ series }: { series: Array<{ day: string; count: number }> }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const w = 120;
  const h = 28;
  const stepX = series.length > 1 ? w / (series.length - 1) : w;
  const points = series
    .map((s, i) => {
      const x = i * stepX;
      const y = h - (s.count / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="text-primary"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}
