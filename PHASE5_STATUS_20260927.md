# THC Health — Phase 5 Production Configuration & Go-live Preparation

วันที่: 27 กันยายน 2569

## สถานะ

**PHASE 5 TECHNICAL PREPARATION COMPLETE — GO-LIVE BLOCKED BY EXPLICIT GATES**

ไม่มีการ merge หรือเปิด Production static website ใน Phase นี้

## ผลดำเนินการ

### 1. Production configuration

สร้าง production configuration แยกจาก staging:

- `site.config.production.js`
- Public/Admin API: `thc-health-api`
- One Stop equipment API: `line-service-hub-web`
- LINE contact: `https://line.me/R/ti/p/@610ndlrx`
- Office hours ยังคง `confirmed=false` เพื่อไม่ประกาศเวลาที่ผู้ดูแลยังไม่ได้ยืนยัน

สร้าง `thc_health.production` ใน `public.system_settings` สำหรับ production gates และสถานะ go-live

### 2. Production API

Deploy `thc-health-api` version `1.0.0-prep`

ผลตรวจ:
- health: PASS
- public payload: PASS
- readiness: PASS
- ADMIN authentication/load/write: PASS
- STAFF authentication: PASS
- STAFF write denied: PASS
- test users/content cleanup: PASS

เพิ่ม login rate limit: 5 ครั้งต่อประมาณ 10 นาทีต่อ IP และ clear หลัง login สำเร็จ

### 3. One Stop equipment request

Apply migration:
- `phase5_one_stop_service_requests`
- `phase5_equipment_requests_line_user_fk_index`

เพิ่ม:
- `line_hub.equipment_requests`
- `public.linehub_public_schedule_v1()`
- `public.linehub_submit_equipment_request_v1(...)`

หลักการ:
- request เป็นเพียงความประสงค์
- response คืน `reservation_confirmed=false`
- ไม่กล่าวหรือรับรองว่ามีของพร้อมยืม
- public/anon/authenticated ไม่มีสิทธิ์เข้าตารางโดยตรง
- write ผ่าน service-role Edge Function เท่านั้น

Live E2E:
- equipment request HTTP 202
- ได้ public reference
- test row ถูกลบหลังทดสอบ
- ไม่มี Phase 5 test request ค้าง

### 4. Single source of truth สำหรับเวลาทำการ

`linehub_public_schedule_v1()` อ่านจาก:

`public.system_settings -> thc_health.office_hours`

ไม่สร้างค่าเวลาทำการซ้ำใน `line_hub.system_config`

ปัจจุบัน:
- Monday–Friday
- 08:30–16:30
- timezone Asia/Bangkok
- `confirmed=false`

ดังนั้นหน้าเว็บแสดง “เวลาทำการรอยืนยัน” แทนการประกาศว่าเปิดบริการ

### 5. Public website service flow

ปรับหน้า THC Health:

- One Stop hero → เลื่อนไปส่วนบริการ
- นัดหมาย → LINE contact/identity flow
- ยืมอุปกรณ์ → dialog ขนาดเล็กใน THC Health
- ติดต่อเจ้าหน้าที่ → LINE
- equipment deep link รองรับ `#equipment-request`

Form ยืมอุปกรณ์ใช้เฉพาะ:
- ประเภทอุปกรณ์
- จำนวน
- ผู้ใช้อุปกรณ์/เหตุผลสั้น ๆ
- เบอร์ติดต่อ

ข้อความหลังส่ง:
“รับคำขอแล้ว … เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ การส่งคำขอยังไม่ใช่การยืนยันว่ามีอุปกรณ์พร้อมยืม”

### 6. Admin Production Readiness

เพิ่มการ์ดตรวจ gate ในหลังบ้าน:

- identity
- One Stop URL
- LINE contact
- office hours confirmed
- Admin E2E
- repository created

ระบบไม่แสดง “พร้อม Deploy” จนผ่านทุก gate

### 7. Production build

เพิ่ม:
- `deploy/build-production.ps1`
- `deploy/PRODUCTION_GO_LIVE_RUNBOOK.md`

Production build:
- ใช้ `site.config.production.js`
- CSP/security headers
- admin noindex
- public robots allow
- rollback plan

Local production build: PASS

Lighthouse:
- Performance: **100**
- Accessibility: **100**
- Best Practices: **100**
- FCP: 0.8 s
- LCP: 1.1 s
- TBT: 0 ms
- CLS: 0

หมายเหตุ: Lighthouse CLI บน Windows แจ้ง EPERM ตอน cleanup temp directory หลังสร้าง report แต่ JSON report ถูกสร้างสมบูรณ์

### 8. LINE Service Hub API

`line-service-hub-web` upgrade เป็น version `1.1.0`

เพิ่ม:
- shared public schedule
- equipment-request action
- staging CORS
- response ระบุ `reservation_confirmed=false`

Health check: PASS

ไม่ได้ cutover หน้า Cloudflare Pages เดิม และไม่เปิด service registry ที่ปัจจุบันยัง disabled

### 9. Database / Advisor

แก้ performance advisor เรื่อง unindexed FK แล้วด้วย:

`equipment_requests_line_user_id_idx`

หลังแก้:
- `unindexed_foreign_keys`: ไม่พบ
- unused-index INFO ยังมีตามปกติ รวม index ใหม่ที่ยังไม่มี production traffic
- security INFO `rls_enabled_no_policy` ยังคงพบใน internal tables รวม `equipment_requests`; ตารางใหม่ถูก revoke จาก public/anon/authenticated และตั้งใจให้ service role เท่านั้นเข้าถึง
- WARN `Leaked Password Protection Disabled` ยังเป็นค่าเดิมของ Auth และไม่ได้เปลี่ยนใน Phase นี้

อ้างอิง remediation:
- RLS: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Unused index: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## E2E cleanup

ยืนยันหลังทดสอบ:
- temporary Phase 5 profiles = 0
- temporary WebsiteNews rows = 0
- temporary equipment requests = 0

Temporary E2E Edge Function ถูก retire หลังทดสอบ

## Readiness ปัจจุบัน

```json
{
  "identity": true,
  "oneStopUrl": true,
  "lineContact": true,
  "officeHoursConfirmed": false,
  "adminE2E": true,
  "repoCreated": false,
  "readyToDeploy": false,
  "goLiveApproved": false,
  "productionUrlConfigured": false
}
```

## Gates ที่ตั้งใจยังไม่ผ่าน

1. **Office hours confirmation** — ห้ามยืนยันอัตโนมัติ
2. **Repository `kelang-health/thc-health`** — connector ปัจจุบันไม่มี create-repository action
3. **Production URL** — ต้องเกิดหลังสร้าง hosting/repository จริง
4. **Go-live approval** — ต้องอนุมัติหลัง 1–3 ผ่าน

## Rollback

- PR ยังเป็น Draft
- ยังไม่ merge เข้า `main`
- Production static site ยังไม่เปิด
- LINE Service Hub / OSM-PHC / JHCIS ยังคงแยกและใช้งานต่อได้
- migration เป็น additive
- ข้อมูล request จริงในอนาคตห้ามลบเพื่อ rollback; ให้ปิด entry point แทน

## สถานะปลาย Phase 5

`thc_health.production.state = phase5_complete_waiting_gates`

Phase 5 จบในส่วนที่ทำได้โดยไม่เดาข้อมูลและไม่ตัดสินใจ go-live แทนผู้ดูแลระบบ


## Final verification

- Internet staging redeploy ล่าสุด: PASS
- Public staging HTTP 200
- Admin staging HTTP 200
- Production API health: PASS
- Production readiness endpoint: PASS
- `anon` privilege บน `line_hub.equipment_requests`: SELECT/INSERT/UPDATE/DELETE = false
- `authenticated` privilege บน `line_hub.equipment_requests`: SELECT/INSERT/UPDATE/DELETE = false
- Performance Advisor: `unindexed_foreign_keys` ถูกแก้แล้ว
- Applied migrations:
  - `phase5_one_stop_service_requests`
  - `phase5_equipment_requests_line_user_fk_index`

Final technical state ยังคง:
- `officeHoursConfirmed=false`
- `repoCreated=false`
- `readyToDeploy=false`
- `goLiveApproved=false`

นี่เป็น fail-safe ที่ตั้งใจไว้ ไม่ใช่ความผิดพลาดของระบบ