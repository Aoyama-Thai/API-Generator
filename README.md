# API Generator

ระบบจัดการ API ผ่าน Web UI — สร้างกลุ่ม API, จัดการ SQL Query, เชื่อมต่อ MS SQL Server / PostgreSQL / IBM DB2

## ความสามารถ

- หน้า Login และ Dashboard สถิติการใช้งาน
- จัดการ Database Connections (MSSQL, PostgreSQL, DB2)
- จัดการ SQL Queries พร้อมทดสอบรัน
- จัดการ API Groups และ APIs
- Runtime API: `/runtime/{group-prefix}/{api-path}` (โหลดจาก DB ทุก request — สร้าง/แก้ไข API แล้วใช้งานได้ทันที ไม่ต้อง restart)

## เริ่มต้นใช้งาน

```bash
cd api-generator
cp .env.example .env
npm install
npm start
```

เปิดเบราว์เซอร์: http://localhost:3001

**ค่าเริ่มต้น:** username `admin` / password `admin123` (แก้ใน `.env`)

## IBM DB2

ติดตั้ง driver เพิ่มเติม (optional):

```bash
npm install ibm_db
```

ต้องมี IBM Data Server Driver บนเครื่อง

## ตัวอย่าง SQL Parameter

ใช้ `:paramName` ใน SQL:

```sql
SELECT * FROM users WHERE id = :id
```

Parameters JSON ของ API:

```json
[{"name":"id","source":"query","required":true}]
```
```sample
http://localhost:3000/runtime/pdt/part/list?part_no=%
```

## โครงสร้าง

- `api-generator/` — Backend Node.js + Express
- `views/` — EJS templates
- `data/app.db` — SQLite metadata (ใช้ `node:sqlite` ในตัว Node.js ไม่ต้อง build native module)
