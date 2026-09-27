# THC Health — Production Go-live Runbook

## เป้าหมาย

เปิดเว็บไซต์สาธารณะโดยไม่กระทบ OSM-PHC, JHCIS, Medical Equipment Sharing หรือ LINE Service Hub เดิม

## Production architecture

- Static frontend: repository `kelang-health/thc-health` (เมื่อสร้างแล้ว)
- Public/Admin API: `thc-health-api`
- Equipment request API: `line-service-hub-web`
- Public content/settings: Supabase project เดิม
- Clinical source: JHCIS (ไม่ถูกเรียกจาก public browser)

## Hard gates ก่อน Deploy

ต้องผ่านทุกข้อ:

1. `thc_health.office_hours.confirmed = true`
2. LINE contact URL ถูกต้อง
3. Admin/Staff E2E ผ่าน
4. repository `kelang-health/thc-health` ถูกสร้างจริง
5. Production API health/readiness ผ่าน
6. ไม่มีข้อมูลทดสอบค้าง
7. ผู้ดูแลอนุมัติ go-live

## Build

จากโฟลเดอร์ `health-center-web`:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\build-production.ps1
```

ผลลัพธ์อยู่ที่ `dist-production\`

ไฟล์ production build ใช้ `site.config.production.js` แทน staging config

## Smoke test

ตรวจอย่างน้อย:

- หน้าแรก HTTP 200
- Mobile 390px และ Desktop
- `thc-health-api?api=health` HTTP 200
- `thc-health-api?api=readiness`
- Appointment เปิด LINE
- Equipment form รับ request แล้วคืน reference โดยไม่กล่าวว่ามีของพร้อมยืม
- Contact เปิด LINE
- Admin login
- STAFF ถูกปฏิเสธการ write
- ข่าว active แสดง / inactive ไม่แสดง
- ไม่พบ CID, JHCIS PID, diagnosis, medication, result หรือ LINE user id ใน public payload

## Rollback

1. ย้อน static deployment ไป version ก่อนหน้า
2. Production API เป็น additive และไม่ต้อง rollback database เมื่อ frontend ยังไม่เปิด
3. หาก equipment request มีปัญหา ให้ปิด entry point ฝั่ง frontendก่อน โดยเก็บตาราง request ไว้เพื่อ audit
4. ห้าม rollback โดยลบข้อมูลประชาชนที่รับคำขอแล้ว
5. LINE Service Hub / OSM-PHC / JHCIS ทำงานต่อแยกจาก THC Health

## ข้อมูลที่ยังไม่ควรเดา

- เวลาทำการจริง
- วันหยุด/วันปิดเฉพาะกิจ
- โทรศัพท์ ที่อยู่ และ map URL ถ้ายังไม่ได้ยืนยัน
- Production URL จนกว่าจะสร้าง hosting จริง