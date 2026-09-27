# THC Health

ต้นแบบเว็บไซต์สาธารณะสำหรับ **ศูนย์บริการสาธารณสุขบ้านโทกหัวช้าง เทศบาลเมืองเขลางค์นคร**

ชื่อ repository ที่ตกลงใช้เมื่อแยกโครงการ: **`thc-health`**

## Phase 1 — Foundation

สถานะ: **PASS**

- Responsive mobile/desktop
- Header + ตราเทศบาล
- One Stop Service cards
- ข่าว/ประกาศ section
- Trusted health sources
- About/data-boundary section
- Static-first architecture
- ไม่มี clinical data ใน public website

## Phase 2 — Public integration

สถานะ: **PASS (staging)**

- เชื่อมข้อมูล Dynamic โดยไม่ให้ Browser แตะ JHCIS หรือ OSM-PHC
- One Stop Service ใช้ระบบ LINE Service Hub เดิม
- ข่าว/ประกาศใช้ `med-device-sharing.public_content`
- ไม่สร้างข่าวสมมติ
- หาก Cloud ใช้ไม่ได้ หน้า Static ยังเปิดได้

## Phase 3 — Shared backend + Admin

สถานะ: **PASS (staging) / NOT PRODUCTION**

### Shared backend

สร้าง Supabase Edge Function แยกสำหรับ staging:

`thc-health-stage-api` — version `0.3.0-stage`

Public website เรียก Dynamic API เพียง **1 request** แล้วได้รับเฉพาะ:

- site information
- office-hours configuration
- ข่าว/ประกาศที่ Active สูงสุด 3 รายการ
- system status

Browser ไม่ได้รับ service-role key และไม่ Query ตารางสุขภาพ

### Database

ไม่ได้เพิ่มตารางใหม่

ใช้ของเดิม:

- `public.system_settings`
  - `thc_health.site`
  - `thc_health.office_hours`
- `public.public_content`
  - `WebsiteNews`
  - `WebsiteAnnouncement`

ค่าเวลาทำการปัจจุบันเป็น **draft / confirmed=false**
จึงไม่ถูกนำไปแสดงเป็นเวลาทางการจนกว่า Admin จะยืนยัน

### Admin console

เพิ่ม:

- `admin.html`
- `admin.css`
- `admin.js`

รองรับ:

1. Login ด้วยบัญชีเจ้าหน้าที่ Medical Equipment Sharing / LINE Service Hub
2. ADMIN แก้ข้อมูลหน่วยบริการ
3. ADMIN ตั้งวันและเวลาทำการ
4. ADMIN ระบุวันหยุดและปิดบริการเฉพาะกิจ
5. ADMIN ยืนยันเวลาทำการก่อนแสดงจริง
6. ADMIN เพิ่ม/แก้ไข/ซ่อนข่าวและประกาศ
7. STAFF อ่านได้ แต่แก้ไม่ได้

### Public data policy

หน้าเว็บไม่แสดงและ Public API ไม่ส่ง:

- CID
- JHCIS PID
- diagnosis
- ยา
- ผลตรวจ
- เวชระเบียน
- LINE user ID
- patient mapping

## Staging

Local staging:

`http://127.0.0.1/thc-health-stage/health-center-web/`

Admin staging:

`http://127.0.0.1/thc-health-stage/health-center-web/admin.html`

ยังไม่มีการ Deploy หน้าเว็บนี้เป็น Production

## ผลทดสอบ Phase 3

- Public staging: HTTP 200
- Admin staging: HTTP 200
- Edge API health/public: HTTP 200
- CORS จาก `http://127.0.0.1`: PASS
- Admin API ไม่มี token: HTTP 401
- JavaScript syntax: PASS
- Mobile 390×844: PASS
- Desktop 1440×900: PASS
- Admin mobile 390×844: PASS
- ข่าว Production: ยังไม่มี WebsiteNews / WebsiteAnnouncement จึงแสดงข้อความกลาง
- Dynamic public API latency 5 ครั้ง: 0.456–0.988 วินาที, median ประมาณ 0.57 วินาที
- Static local HTML: ประมาณ 0.001 วินาที

## Data boundary

```text
THC Health public website
        |
        | 1 public request
        v
THC Health Stage API
        |
        +-- public.system_settings
        |     +-- thc_health.site
        |     \-- thc_health.office_hours
        |
        +-- public.public_content
        |     +-- WebsiteNews
        |     \-- WebsiteAnnouncement
        |
        +-- LINE Service Hub / One Stop
                  |
                  +-- Equipment request
                  +-- Citizen identity mapping
                  \-- Appointment date-only gateway

OSM-PHC
  \-- อสม./staff/community health workflows (separate)

JHCIS
  \-- clinical source of truth; never queried by public browser
```

## จุดที่ยังไม่ปิดก่อน Production

1. ยืนยันเวลาทำการจริง
2. ยืนยัน LINE ติดต่อเจ้าหน้าที่ Production
3. เพิ่มข่าว/ประกาศจริงจาก Admin
4. ทดสอบ Admin login end-to-end ด้วยบัญชีจริง
5. แยกออกเป็น repository `kelang-health/thc-health` เมื่อสร้าง repo ใหม่ได้
6. Deploy staging internet-facing ก่อน Production
7. Security advisor เดิมของ project ยังแจ้ง Leaked Password Protection ปิดอยู่ และบาง private/RLS tables ไม่มี policy; Phase 3 ไม่เปลี่ยน Auth/RLS เดิม



## Phase 4 — Production readiness

สถานะ: **PARTIAL PASS / NOT PRODUCTION**

ผ่านแล้ว:
- Internet-facing temporary staging
- Public/Admin route smoke test
- CORS/API boundary
- News publish → hide → cleanup
- Public payload privacy scan
- Lighthouse: Performance 100 / Accessibility 100 / Best Practices 100
- Security headers สำหรับ staging

ยังค้าง:
- ยืนยันเวลาทำการจริง (`confirmed=false`)
- ยืนยัน LINE contact URL
- Real Admin Login ด้วย credential จริง
- แยก repository `thc-health`
- Production cutover approval

รายละเอียด: `PHASE4_STATUS_20260927.md`


## Phase 5 — Production Configuration & Go-live Preparation

สถานะ: **TECHNICAL PREPARATION COMPLETE / GO-LIVE WAITING GATES**

ผ่านแล้ว:
- Production API `thc-health-api` v1.0.0-prep
- Admin/Staff Auth + RBAC E2E บน production API
- Login rate limiting
- One Stop equipment-request backend + table/RPC
- Equipment request E2E HTTP 202 + cleanup
- LINE contact เชื่อมกับช่องทางที่ระบบ One Stop ใช้อยู่
- Single source of truth สำหรับเวลาทำการ
- Inline equipment request ใน THC Health โดยไม่แสดง/รับรอง stock availability
- Production static build + CSP/security headers + rollback runbook
- Lighthouse production build: Performance 100 / Accessibility 100 / Best Practices 100
- FK index hardening หลังตรวจ Supabase Advisor
- ไม่มีข้อมูล E2E ชั่วคราวค้าง

ยังไม่ผ่านโดยตั้งใจ:
- `thc_health.office_hours.confirmed=false`
- repository `kelang-health/thc-health` ยังไม่ได้สร้าง
- Production URL ยังไม่กำหนด
- `go_live_approved=false`

ดังนั้น Phase 5 ปิดงานด้าน technical preparation แล้ว แต่ระบบจะไม่เปิด Production เองจนกว่าผู้ดูแลยืนยัน gates ที่เหลือ

รายละเอียด: `PHASE5_STATUS_20260927.md`