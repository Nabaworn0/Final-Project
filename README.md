# CED Teaching Assessment

เว็บต้นแบบสำหรับนักศึกษาคอมพิวเตอร์ศึกษา ใช้อัปโหลดแผนการสอนเป็นเอกสารอ้างอิง และเตรียมรองรับการเปรียบเทียบคลิปฝึกสอนกับแผน ส่วนอาจารย์สำหรับให้คะแนนและ Feedback จะพัฒนาในระยะถัดไป

## เริ่มใช้งานใน Command Prompt

```bat
cd C:\Users\USER\Documents\AI-Teaching-Assessment
npm install
npm start
```

เปิด `http://localhost:3000` หลังระบบเริ่มทำงาน หากต้องการหยุดให้กด `Ctrl+C`

คำสั่งที่ใช้บ่อย:

```bat
npm start
npm run build
npm run preview
npm run lint
npm test
```

## บัญชีตัวอย่าง

- นักศึกษา: `student@email.kmutnb.ac.th`
- อาจารย์: `instructor@email.kmutnb.ac.th`
- รหัสผ่าน: `demo1234`

## เอกสารสำหรับพัฒนา

- [โครงสร้างโครงการ](docs/PROJECT_STRUCTURE.md)
- [นโยบายการเก็บไฟล์](docs/r2-storage-policy.md)

เทคโนโลยีหลัก: React, TypeScript, vinext, Cloudflare D1/R2 และ Drizzle ORM
