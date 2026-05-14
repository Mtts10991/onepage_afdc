import type { Config } from "tailwindcss";

/**
 * Tailwind 4 ใช้ CSS-first config เป็นหลัก (@theme ใน globals.css)
 * ไฟล์นี้ใช้สำหรับ content path เท่านั้น
 * Animation plugin: tw-animate-css ถูก import ใน globals.css แล้ว
 */
const config: Config = {
  // Tailwind v4 typing: `["class", selector]` form requires a selector tuple.
  // We just want the class strategy globally, so a bare string is correct.
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
};

export default config;
