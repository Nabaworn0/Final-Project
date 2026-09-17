export function LessonPlanUploadForm({ error }: { error?: string }) {
  const messages: Record<string, string> = {
    "file-required": "กรุณาเลือกไฟล์แผนการสอนก่อนบันทึก",
    "file-too-large": "ไฟล์มีขนาดเกิน 20 MB",
    "file-type": "รองรับเฉพาะไฟล์ PDF และ DOCX ที่ถูกต้อง",
    unavailable: "ยังไม่สามารถบันทึกไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
  };

  return <div className="upload-first-layout">
    <form className="system-card upload-first-card" action="/api/student/lesson-plans/upload" method="post" encType="multipart/form-data">
      <p className="card-label">LESSON PLAN REFERENCE</p>
      <h2>อัปโหลดแผนไว้สำหรับการเปรียบเทียบ</h2>
      <p>แผนจะถูกเก็บเป็นเอกสารอ้างอิง โดยยังไม่มีการตรวจ ให้คะแนน หรือแนะนำการแก้ไข จนกว่าจะเลือกแผนนี้ไปเปรียบเทียบกับคลิปฝึกสอน</p>
      {error && <div className="login-error" role="alert">{messages[error] ?? messages.unavailable}</div>}
      <div className="form-row plan-reference-fields">
        <label>ชื่อหัวข้อการสอน<input name="title" minLength={3} maxLength={160} placeholder="เช่น การเขียนโปรแกรมแบบวนซ้ำด้วย Python" required /></label>
        <label>รายวิชา<input name="course" minLength={2} maxLength={160} placeholder="เช่น การเขียนโปรแกรมคอมพิวเตอร์" required /></label>
      </div>
      <label className="document-drop-zone">
        <span aria-hidden="true">↑</span>
        <strong>เลือกไฟล์แผนการสอน</strong>
        <small>PDF หรือ DOCX · ไม่เกิน 20 MB</small>
        <input name="attachment" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
      </label>
      <button className="analyze-button" type="submit">บันทึกแผนการสอน →</button>
      <p className="upload-privacy">ระบบจะใช้เนื้อหาจากแผนเมื่อมีการอัปโหลดคลิปเพื่อเริ่มเปรียบเทียบเท่านั้น</p>
    </form>
    <aside className="process-card miap-process upload-guide">
      <p className="card-label">ขั้นตอนการใช้งาน</p>
      <h3>เก็บแผนก่อน แล้วจึงเพิ่มคลิป</h3>
      {[
        "ระบุชื่อหัวข้อและรายวิชา", "อัปโหลดไฟล์แผนการสอน", "บันทึกแผนไว้ในรายการของฉัน",
        "เลือกแผนเมื่อเพิ่มคลิปฝึกสอน", "จึงเริ่มถอดเสียงและเปรียบเทียบ",
      ].map((item, index) => <div key={item}><span>0{index + 1}</span>{item}</div>)}
      <p className="process-note">การอัปโหลดแผนเพียงอย่างเดียวจะไม่สร้างคะแนนหรือผลตรวจแผน</p>
    </aside>
  </div>;
}
