import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import {
  avgTimeToComplete,
  dailySeries,
  exportFailureRate,
  formErrorRate,
  lineNotifyOptIn,
  loginAdoptionByProvider,
  mobileCompletionRate,
  supportTicketCount,
  windowFromDays,
} from "@/lib/metrics";
import { MetricCard } from "./_components/metric-card";
import { SupportTicketForm } from "./_components/support-ticket-form";

const ALLOWED_DAYS = [7, 14, 30] as const;
type AllowedDays = (typeof ALLOWED_DAYS)[number];

// Cache the dashboard render for a minute — every metric is an aggregate
// over thousands of audit rows, and a 60-second staleness window is
// invisible to humans skimming trend lines.
export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function MetricsPage({ searchParams }: PageProps) {
  const t = await getTranslations("metrics");
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const rawDays = Number(sp.days);
  const days: AllowedDays = (ALLOWED_DAYS as readonly number[]).includes(rawDays)
    ? (rawDays as AllowedDays)
    : 14;
  const window = windowFromDays(days);

  const [
    formErrors,
    ttc,
    tickets,
    exports,
    loginAdoption,
    notifyOptIn,
    mobile,
    publishSeries,
  ] = await Promise.all([
    formErrorRate(window),
    avgTimeToComplete(window),
    supportTicketCount(window),
    exportFailureRate(window),
    loginAdoptionByProvider(window),
    lineNotifyOptIn(),
    mobileCompletionRate(window),
    dailySeries("onepage.publish", window),
  ]);

  return (
    <div className="space-y-6 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { days })}
          </p>
        </div>
        <nav className="flex gap-2 text-sm">
          {ALLOWED_DAYS.map((d) => (
            <a
              key={d}
              href={`?days=${d}`}
              className={`px-3 py-1 rounded-md border ${
                d === days ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {t("daysWindow", { days: d })}
            </a>
          ))}
        </nav>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <MetricCard
          label={t("formErrorRate")}
          value={`${(formErrors.rate * 100).toFixed(1)}%`}
          hint={t("formErrorHint", {
            num: formErrors.numerator,
            den: formErrors.denominator,
            validation: formErrors.validationFailures,
            fixups: formErrors.fixups,
          })}
        />
        <MetricCard
          label={t("timeToComplete")}
          value={ttc.count === 0 ? "—" : `${Math.round(ttc.p50)}s`}
          hint={
            ttc.count === 0
              ? t("noData")
              : t("ttcHint", { count: ttc.count, p90: Math.round(ttc.p90) })
          }
        />
        <MetricCard
          label={t("supportTickets")}
          value={String(tickets.total)}
          hint={Object.entries(tickets.byCategory)
            .map(([k, v]) => `${t(`category_${k}` as never)}: ${v}`)
            .join(" · ")}
        />
        <MetricCard
          label={t("exportFailureRate")}
          value={`${(exports.failureRate * 100).toFixed(1)}%`}
          hint={t("exportHint", {
            pptxSucc: exports.successes.pptx,
            pptxFail: exports.failures.pptx,
            pngSucc: exports.successes.png,
            pngFail: exports.failures.png,
          })}
        />
        <MetricCard
          label={t("lineLoginAdoption")}
          value={
            loginAdoption.total === 0
              ? "—"
              : `${(loginAdoption.linePercent * 100).toFixed(0)}%`
          }
          hint={t("lineAdoptionHint", {
            line: loginAdoption.line,
            credentials: loginAdoption.credentials,
            total: loginAdoption.total,
          })}
        />
        <MetricCard
          label={t("lineNotifyOptIn")}
          value={
            notifyOptIn.total === 0
              ? "—"
              : `${(notifyOptIn.percent * 100).toFixed(0)}%`
          }
          hint={t("lineNotifyHint", {
            optedIn: notifyOptIn.optedIn,
            total: notifyOptIn.total,
          })}
        />
        <MetricCard
          label={t("mobileCompletionRate")}
          value={
            mobile.sessions === 0
              ? "—"
              : `${(mobile.rate * 100).toFixed(0)}%`
          }
          hint={t("mobileHint", {
            completed: mobile.completed,
            sessions: mobile.sessions,
          })}
        />
        <MetricCard
          label={t("publishesDaily")}
          value={String(publishSeries.reduce((a, p) => a + p.count, 0))}
          hint={t("publishesHint")}
          series={publishSeries}
        />
      </section>

      <SupportTicketForm />

      <p className="text-xs text-muted-foreground">
        {t("foot", { loginTotal: loginAdoption.total })}
      </p>
    </div>
  );
}
