# FB1–FB2: Meta Facebook Page Read Setup

เป้าหมายรอบนี้: เชื่อม Meta App กับ Facebook Page ของศูนย์ และพิสูจน์ว่าอ่านโพสต์ของ Page ผ่าน Graph API ได้ โดยยังไม่สร้างฐาน cache และยังไม่ auto-publish ขึ้นเว็บไซต์

## ขอบเขต

- ใช้ Page: เพจศูนย์บริการสาธารณสุขบ้านโทกหัวช้าง
- Page ID ที่คาดจาก URL: `61583094369573`
- ต้องยืนยัน Page ID จริงจาก `/me/accounts`
- ขอเฉพาะสิทธิ์ขั้นต่ำ:
  - `pages_show_list`
  - `pages_read_engagement`
- ไม่ขอ `pages_manage_posts`
- ไม่ดึง comments, reactions, likes หรือข้อมูลผู้ใช้
- ห้าม commit access token / app secret ลง GitHub

## FB1 — Meta App

1. เปิด https://developers.facebook.com/apps/
2. Create App และเลือก use case ที่รองรับ Facebook Login / Facebook Pages ตามหน้าจอปัจจุบัน
3. App name แนะนำ: `THC Health Public News`
4. เพิ่ม Website URL:
   - https://kelang-health.github.io/thc-health/
5. ใน Graph API Explorer เลือก App ที่สร้าง
6. Generate User Access Token พร้อม:
   - `pages_show_list`
   - `pages_read_engagement`
7. ในช่วง Development mode ให้บัญชีที่ทดสอบเป็น App role และมีสิทธิ์จัดการ Page

## FB2 — Verify Page and Read Posts

ใช้ token เฉพาะใน environment variable ของเครื่องทดสอบ:

```powershell
$env:FACEBOOK_USER_ACCESS_TOKEN="PASTE_TOKEN_HERE"
$env:FACEBOOK_API_VERSION="v26.0"
powershell -ExecutionPolicy Bypass -File .\scripts\facebook-graph-smoke.ps1
```

Script จะ:
1. เรียก `/me/accounts`
2. ตรวจหา Page ID `61583094369573`
3. รับ Page Access Token ไว้ใน memory เท่านั้น
4. เรียก `/{PAGE_ID}/posts`
5. แสดงเฉพาะข้อมูลปลอดภัยของโพสต์ 5 รายการล่าสุด
6. ไม่พิมพ์ access token ออกหน้าจอ

## เกณฑ์ PASS

FB1 PASS เมื่อ:
- Meta App ถูกสร้าง
- User token มี `pages_show_list` และ `pages_read_engagement`
- บัญชีทดสอบเข้าถึง Page ได้

FB2 PASS เมื่อ:
- `/me/accounts` คืน Page ของศูนย์
- Page ID ตรงกับ Page จริง
- `/{PAGE_ID}/posts` คืนโพสต์ของ Page อย่างน้อย 1 รายการ หรือคืน empty list อย่างถูกต้องหาก Page ไม่มีโพสต์
- ได้ fields: `id,message,created_time,permalink_url,full_picture`
- ไม่มี token ถูกเก็บใน repo/log

## หลัง FB2 ผ่าน

จึงค่อยเริ่ม FB3:
- Supabase Edge Function `facebook-news-sync`
- secret storage
- cache table
- privacy review
- Admin approval
