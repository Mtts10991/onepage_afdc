"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import type { OnePagePlanData } from "@/lib/onepage-schema";
import styles from "./onepage-preview.module.scss";

interface Props {
  data: OnePagePlanData;
  title?: string;
}

export const OnePagePreview = forwardRef<HTMLDivElement, Props>(
  function OnePagePreview({ data, title }, ref) {
    const t = useTranslations("onepage");
    const tf = useTranslations("onepage.form");
    const accent = data.accentColor || "#1d4ed8";
    return (
      <div
        ref={ref}
        id="onepage-canvas"
        className={styles.canvas}
        style={{ ["--accent" as any]: accent }}
      >
        {/* Top bar */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            {data.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logoUrl} alt="logo" className={styles.logo} />
            ) : (
              <div className={styles.logoFallback}>{t("logoFallback")}</div>
            )}
            <div>
              <div className={styles.agency}>{data.agency || "—"}</div>
              <div className={styles.subtitle}>{title}</div>
            </div>
          </div>
          <div className={styles.date}>{data.date}</div>
        </header>

        <div className={styles.titleBand}>
          <h1>{data.projectName || t("projectNameFallback")}</h1>
        </div>

        <div className={styles.grid}>
          <section className={styles.left}>
            <Block label={tf("background")} value={data.background} />
            <Block label={tf("objective")} value={data.objective} />
            <Block label={tf("scope")} value={data.scope} />
            <Block label={tf("targetGroup")} value={data.targetGroup} />
            <Block label={tf("responsible")} value={data.responsible} />
          </section>

          <section className={styles.right}>
            {data.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.imageUrl} alt="" className={styles.image} />
            )}

            <div className={styles.metaRow}>
              <MetaCard label={tf("budget")} value={data.budget} />
              <MetaCard label={tf("timelineShort")} value={data.timeline} />
            </div>

            {data.kpis.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>{tf("kpi")}</div>
                <ul className={styles.list}>
                  {data.kpis.map((k, i) => (
                    <li key={i}>
                      <strong>{k.name}</strong>
                      <span> · {k.target}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.activities.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>{tf("activities")}</div>
                <ul className={styles.list}>
                  {data.activities.map((a, i) => (
                    <li key={i}>
                      <strong>{a.name}</strong>
                      <span> · {a.period}</span>
                      <span> · {a.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.outcomeLabel}>{tf("outcome")}</div>
          <div className={styles.outcomeValue}>{data.outcome}</div>
        </footer>
      </div>
    );
  }
);

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.block}>
      <div className={styles.blockLabel}>{label}</div>
      <div className={styles.blockValue}>{value || "—"}</div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaCard}>
      <div className={styles.metaLabel}>{label}</div>
      <div className={styles.metaValue}>{value || "—"}</div>
    </div>
  );
}
