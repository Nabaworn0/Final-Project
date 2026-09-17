# นโยบายการจัดเก็บไฟล์แผนการสอนใน R2

- Storage class: Cloudflare R2 Standard
- ขนาดไฟล์สูงสุดต่อไฟล์: 20 MB
- อายุไฟล์ต้นฉบับ: 180 วันนับจากวันที่อัปโหลด
- เมื่อครบกำหนด: ลบไฟล์ต้นฉบับออกจาก R2 แต่เก็บข้อมูลแผน ข้อความที่สกัด และผลวิเคราะห์ไว้ใน D1
- การตรวจไฟล์หมดอายุ: ระบบตรวจไม่เกินหนึ่งครั้งต่อชั่วโมงเมื่อมีการใช้งานหน้าแผนการสอน
- Budget Alert ที่แนะนำ: 1 USD ต่อรอบบิล ชื่อ `R2 teaching assessment warning`

## การตั้ง Budget Alert ในบัญชี Cloudflare

1. เข้าสู่ Cloudflare Dashboard และเลือกบัญชีที่ถือ R2 bucket
2. เปิด **Manage Account → Billing → Billable Usage**
3. เลือก **Create budget alert**
4. ตั้งชื่อ `R2 teaching assessment warning`
5. ตั้ง Budget threshold เป็น `1 USD` และเลือกอีเมลผู้รับผิดชอบ

Budget Alert เป็นการแจ้งเตือน ไม่ใช่เพดานหยุดการใช้งาน และต้องตั้งจากบัญชี Cloudflare ที่มีสิทธิ์ด้าน Billing

อ้างอิง:

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/billing/manage/budget-alerts/
