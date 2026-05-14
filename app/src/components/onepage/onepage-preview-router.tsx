"use client";

import { forwardRef } from "react";
import { OnePagePreview } from "./onepage-preview";
import { ReportPreview } from "./report-preview";
import type { OnePageData } from "@/lib/onepage-schema";

interface Props {
  data: OnePageData;
  title?: string;
}

/**
 * เลือก preview component ตาม data.type
 */
export const OnePagePreviewRouter = forwardRef<HTMLDivElement, Props>(
  function OnePagePreviewRouter({ data, title }, ref) {
    if (data.type === "report") {
      return <ReportPreview ref={ref} data={data} />;
    }
    return <OnePagePreview ref={ref} data={data} title={title} />;
  }
);
