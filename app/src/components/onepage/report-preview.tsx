"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import type { OnePageReportData } from "@/lib/onepage-schema";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import styles from "./report-preview.module.scss";

interface Props {
  data: OnePageReportData;
}

export const ReportPreview = forwardRef<HTMLDivElement, Props>(function ReportPreview(
  { data },
  ref
) {
  const t = useTranslations("report");
  const imgs = data.images.slice(0, 6);
  const slots = Array.from({ length: 6 }, (_, i) => imgs[i] ?? "");
  // Sanitize before render — Tiptap output is user-controlled and reaches
  // dangerouslySetInnerHTML below. Without this, stored XSS is trivial.
  const rawHtml =
    data.paragraphHtml || (data.paragraph ? `<p>${escapeHtml(data.paragraph)}</p>` : "");
  const html = sanitizeRichHtml(rawHtml);

  const primary = data.primaryColor || data.headerColor || "#1e3a7a";

  const dateColor = data.dateColor || primary;

  return (
    <div
      ref={ref}
      id="onepage-canvas"
      className={styles.page}
      data-screen-label="01 One Page Template"
      style={
        {
          ["--header-blue" as any]: primary,
          ["--header-blue-dark" as any]: darken(primary, 0.25),
          ["--border" as any]: primary,
          ["--date-color" as any]: dateColor,
        } as React.CSSProperties
      }
    >

      {/* HEADER */}
      <header className={styles.header}>
        <div className={`${styles.headerLogo} ${styles.left}`}>
          <div className={styles.ring} />
          {data.leftLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.leftLogoUrl} alt="left logo" />
          ) : (
            <span>{t("logoLeftFallback")}</span>
          )}
        </div>

        <h1
          style={{
            fontSize: `${data.agencyNameFontSize}pt`,
            fontWeight: data.agencyNameBold ? 700 : 400,
          }}
        >
          {data.agencyName || t("form.agencyNameLabel")}
        </h1>
        <h2
          style={{
            fontSize: `${data.subAgencyFontSize}pt`,
            fontWeight: data.subAgencyBold ? 700 : 400,
          }}
        >
          {data.subAgency}
        </h2>
        {data.dateLine && <div className={styles.date}>{data.dateLine}</div>}

        <div className={`${styles.headerLogo} ${styles.right}`}>
          <div className={styles.ring} />
          {data.rightLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.rightLogoUrl} alt="right logo" />
          ) : (
            <span>{t("logoRightFallback")}</span>
          )}
        </div>
      </header>

      {/* PHOTO GRID 2 × 3 (4:3 ratio per cell) */}
      <section className={styles.photos}>
        {slots.map((src, i) => (
          <figure key={i} className={styles.photo}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`photo ${i + 1}`} className={styles.photoImg} />
            ) : (
              <span className={styles.label}>{t("photoPlaceholder")}</span>
            )}
          </figure>
        ))}
      </section>

      {/* CAPTION (rich text from Tiptap)
          When `html` is empty we render the placeholder as plain text in JSX
          instead of injecting it through dangerouslySetInnerHTML — this lets
          the i18n string stay tag-free (next-intl reserves `<...>` for rich
          text tags) and avoids an unnecessary innerHTML write. */}
      {html ? (
        <div
          className={styles.caption}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className={styles.caption}>
          <p>{t("contentDefault")}</p>
        </div>
      )}

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footSide}>
          <BrandIcon kind="chrome" />
          <Qr url={data.websiteQrUrl || data.qrUrl} />
        </div>

        <div
          className={styles.slogan}
          style={{
            fontSize: `${data.sloganFontSize}pt`,
            fontWeight: data.sloganBold ? 700 : 400,
          }}
        >
          {renderSlogan(data.slogan || t("defaultSlogan"))}
        </div>

        <div className={`${styles.footSide} ${styles.footRight}`}>
          <Qr url={data.facebookQrUrl} />
          <BrandIcon kind="facebook" />
        </div>
      </footer>
    </div>
  );
});

// ---------- helpers ----------
function renderSlogan(s: string) {
  // แยกด้วย · หรือ /  หรือ , เป็นจุดน้ำเงินคั่น
  const parts = s.split(/[·•\/,]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return s;
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <span className={styles.dot} aria-hidden />}
    </span>
  ));
}

function Qr({ url }: { url: string | null | undefined }) {
  return (
    <div className={styles.qr}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="qr" />
      ) : (
        <PlaceholderQrSvg />
      )}
    </div>
  );
}

function PlaceholderQrSvg() {
  return (
    <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      <rect width="21" height="21" fill="#fff" />
      <g fill="#111">
        <rect x="0" y="0" width="7" height="7" />
        <rect x="14" y="0" width="7" height="7" />
        <rect x="0" y="14" width="7" height="7" />
      </g>
      <g fill="#fff">
        <rect x="1" y="1" width="5" height="5" />
        <rect x="15" y="1" width="5" height="5" />
        <rect x="1" y="15" width="5" height="5" />
      </g>
      <g fill="#111">
        <rect x="2" y="2" width="3" height="3" />
        <rect x="16" y="2" width="3" height="3" />
        <rect x="2" y="16" width="3" height="3" />
      </g>
    </svg>
  );
}

function BrandIcon({ kind }: { kind: "chrome" | "facebook" }) {
  if (kind === "facebook") {
    return (
      <div className={styles.brandIcon} aria-label="Facebook">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="22" fill="#1877f2" />
          <path
            d="M27.5 46V28.4h5.9l.9-6.9h-6.8v-4.4c0-2 .55-3.36 3.4-3.36h3.65V7.5c-.63-.08-2.8-.27-5.32-.27-5.27 0-8.88 3.22-8.88 9.12v5.14H14.4v6.9h5.95V46h7.15Z"
            fill="#fff"
          />
        </svg>
      </div>
    );
  }
  // chrome
  return (
    <div className={styles.brandIcon} aria-label="Chrome">
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="chRed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d93025" />
            <stop offset="1" stopColor="#ea4335" />
          </linearGradient>
          <linearGradient id="chYellow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fcc934" />
            <stop offset="1" stopColor="#fbbc04" />
          </linearGradient>
          <linearGradient id="chGreen" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e8e3e" />
            <stop offset="1" stopColor="#34a853" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22" fill="#fff" />
        <path
          d="M24 2 A22 22 0 0 1 43.05 13 L29.2 21 A6 6 0 0 0 18.8 21 L7.1 13.5 A22 22 0 0 1 24 2 Z"
          fill="url(#chRed)"
        />
        <path
          d="M43.05 13 A22 22 0 0 1 29 45.3 L24 30 A6 6 0 0 0 29.2 21 Z"
          fill="url(#chYellow)"
        />
        <path
          d="M29 45.3 A22 22 0 0 1 7.1 13.5 L18.8 21 A6 6 0 0 0 24 30 Z"
          fill="url(#chGreen)"
        />
        <circle cx="24" cy="24" r="9" fill="#fff" />
        <circle cx="24" cy="24" r="7.5" fill="#1a73e8" />
      </svg>
    </div>
  );
}

function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
