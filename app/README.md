# OnePage — ระบบจัดทำ One Page สำหรับหน่วยงานราชการ

Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma + SQLite + Auth.js v5

## คุณสมบัติ

- เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน (Auth.js v5, bcrypt)
- ไม่อนุญาตสมัครสมาชิก — Admin สร้างผู้ใช้ให้
- จัดทำ One Page ครบทุก section (โครงการ ผู้รับผิดชอบ KPI กิจกรรม งบประมาณ Timeline ผลลัพธ์)
- อัปโหลด + ครอปรูป (logo / hero image / avatar) ผ่าน `react-easy-crop`
- เก็บประวัติทุกครั้งที่บันทึก → ย้อนกลับเวอร์ชันได้
- Export PPTX (pptxgenjs, server-side) และ PNG (html-to-image)
- รองรับมือถือ (responsive), แอนิเมชันละมุน
- i18n ไทย/อังกฤษ (next-intl)
- Dark/Light theme (next-themes)
- Sidebar ย่อ-ขยายได้, จดจำสถานะ
- เมนู User Management เห็นเฉพาะ Admin
- ฟอนต์ Sarabun (local, ไม่ใช้ CDN)
- ตัวแปร SCSS centralized — ไม่ hardcode CSS
- โครงสร้าง component reusable

## ติดตั้ง

```bash
# 1) วางฟอนต์
# ดาวน์โหลด Sarabun จาก https://fonts.google.com/specimen/Sarabun
# วางไฟล์ Sarabun-Regular.ttf, -Italic, -Medium, -SemiBold, -Bold
# ไว้ที่ public/fonts/

# 2) สำคัญ — ลบไฟล์ middleware.ts ทิ้ง (Next.js 16 ใช้ proxy.ts แทน)
#    ไฟล์ src/middleware.ts ถูกเว้นว่างไว้แล้ว แต่ควรลบทิ้ง
del src\middleware.ts        # Windows
# rm src/middleware.ts       # macOS / Linux

# 3) เตรียม env
copy .env.example .env       # Windows
# cp .env.example .env       # macOS / Linux
# แก้ AUTH_SECRET (`openssl rand -base64 32` หรือ random string ยาว ๆ)

# 4) ติดตั้ง dependencies
npm install

# 5) ตั้งฐานข้อมูล + seed admin
npm run db:push
npm run db:seed

# 6) Dev
npm run dev
# เปิด http://localhost:3000
```

## ตรวจคุณภาพก่อนรัน

```bash
npm run typecheck   # ตรวจ TypeScript errors
npm run lint        # ESLint
npm run build       # production build (จะ generate Prisma + build Next)
```

## บัญชี Admin เริ่มต้น

- email: `admin@admin.com`
- password: `afdc-gso@2026`

(เปลี่ยนผ่านเมนูโปรไฟล์หลังเข้าระบบ หรือแก้ใน `.env` ก่อน seed)

## โครงสร้างโปรเจกต์

```
app/
├── prisma/
│   ├── schema.prisma           # User, OnePage, OnePageVersion
│   └── seed.ts                 # seed admin
├── public/
│   ├── fonts/                  # Sarabun (.ttf, local)
│   └── uploads/                # รูปที่อัปโหลด
├── messages/
│   ├── th.json
│   └── en.json
├── src/
│   ├── app/
│   │   ├── (app)/              # protected (auth required)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── onepages/...
│   │   │   ├── users/page.tsx  # admin only
│   │   │   └── profile/page.tsx
│   │   ├── login/page.tsx
│   │   ├── api/                # backend API (Next.js Route Handlers)
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── onepages/...
│   │   │   ├── users/...
│   │   │   ├── profile/...
│   │   │   └── upload/route.ts
│   │   ├── globals.scss        # Tailwind + SCSS theme
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── auth.ts                 # Auth.js v5 (server)
│   ├── auth.config.ts          # Auth.js v5 (edge-safe)
│   ├── middleware.ts
│   ├── components/
│   │   ├── ui/                 # shadcn/ui
│   │   ├── layout/             # sidebar, header, toggles
│   │   ├── auth/login-form.tsx
│   │   ├── onepage/            # form, preview, export, crop
│   │   ├── users/              # admin user manager
│   │   ├── profile/
│   │   └── providers/
│   ├── i18n/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── utils.ts
│   │   ├── onepage-schema.ts   # ปรับ field OnePage ที่นี่ที่เดียว
│   │   └── export-pptx.ts
│   ├── styles/                 # SCSS variables/mixins/theme
│   │   ├── _variables.scss
│   │   ├── _mixins.scss
│   │   ├── _theme.scss
│   │   └── _animations.scss
│   └── types/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

## ปรับแต่ง

- เพิ่ม/ลด field ของ OnePage → แก้ที่ `src/lib/onepage-schema.ts` แล้ว `OnePageForm` / `OnePagePreview` / `export-pptx.ts` จะอ่านจากที่เดียวกัน
- เปลี่ยน color/spacing/font → แก้ `src/styles/_variables.scss` หรือ `_theme.scss`
- เพิ่มภาษา → เพิ่มไฟล์ใน `messages/` แล้วเพิ่มใน `src/i18n/config.ts`

## คำสั่งที่มี

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | build production |
| `npm run start` | start production |
| `npm run db:push` | sync schema → SQLite |
| `npm run db:migrate` | สร้าง migration |
| `npm run db:studio` | Prisma Studio (GUI) |
| `npm run db:seed` | seed admin |

## หมายเหตุ / Known notes

- รูปอัปโหลดเก็บที่ `public/uploads/` (อย่า commit เข้า git)
- ไฟล์ `prisma/dev.db` ก็เช่นกัน
- หาก deploy production: ตั้ง `AUTH_SECRET` ใหม่, ใช้ HTTPS, ตั้ง `NEXTAUTH_URL` ถูกต้อง
- **Next.js 16**: ใช้ `src/proxy.ts` (รัน Node.js runtime) แทน `middleware.ts` เดิม — ถ้าเจอ warning เรื่อง deprecated middleware ให้ลบ `src/middleware.ts` ทิ้ง
- **next-intl v4**: `getRequestConfig` ใช้ `requestLocale` แล้ว fallback ไป cookie `locale`
- **shadcn + Tailwind 4**: ใช้ `tw-animate-css` (import ใน `globals.css`) แทน `tailwindcss-animate` (plugin เดิม)
- **Auth.js v5 beta**: ปัจจุบันยังเป็น beta ก่อน deploy production ตรวจดู changelog อีกครั้ง

## Audit ที่ทำผ่านแล้ว

- [x] Package versions ตรวจกับ web search (May 2026) — Next.js 16.x ออก stable แล้ว, Auth.js v5 beta ใช้กับ Next 16 ได้
- [x] `await params/cookies/headers` ทุก route handler/page
- [x] Suspense รอบ `useSearchParams` (login form)
- [x] `serverActions` ย้ายจาก `experimental` มา top-level (Next 16)
- [x] `react-easy-crop` ใช้ `import type { Area }`
- [x] `pptxgenjs` cast result เป็น Buffer
- [x] `tw-animate-css` แทน `tailwindcss-animate`
- [x] middleware → proxy (Next 16 convention)
- [x] Route handler dynamic params signature `Promise<{ id }>`
- [x] Server vs Client component แยกชัด ("use client" ครบ)
- [x] Admin guard ทั้งฝั่ง UI (sidebar) และ API (`requireAdmin()`)
- [x] OnePage ownership guard ทุก route (`assertOwner`)

## ยังไม่ได้ตรวจ (เพราะ shell sandbox ไม่ทำงานตอนสร้าง)

- ยังไม่ได้รัน `npm install` + `npm run build` จริง ๆ — กรุณารันบนเครื่องคุณก่อนใช้งานจริง
- ถ้า build ฟ้อง error อะไร แจ้งมาผมแก้ให้
