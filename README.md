# API Generator

ระบบจัดการ API ผ่าน Web UI — สร้างกลุ่ม API, จัดการ SQL Query, เชื่อมต่อหลายประเภทฐานข้อมูล

## ความสามารถ

- หน้า Login และ Dashboard สถิติการใช้งาน
- จัดการ Database Connections (MSSQL, PostgreSQL, MySQL, MariaDB, SQLite, MongoDB, DB2)
- จัดการ SQL Queries พร้อมทดสอบรัน
- จัดการ API Groups และ APIs
- สำรอง/นำเข้าข้อมูล (Connections, SQL Queries, API Groups, APIs) เป็นไฟล์ JSON
- Runtime API: `/runtime/{group-prefix}/{api-path}` (โหลดจาก DB ทุก request — สร้าง/แก้ไข API แล้วใช้งานได้ทันที ไม่ต้อง restart)
- จัดการ **CORS** สำหรับ Frontend ที่รันคนละ port (เมนู CORS ใน sidebar)

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

## SQLite

- **Database Name** = พาธไฟล์ `.db` (เช่น `D:/data/my.db`)
- Host/Port/Username ไม่จำเป็น (ระบบตั้งให้อัตโนมัติ)

## MongoDB

ใส่ Query เป็น JSON ใน SQL Queries (แทน SQL):

```json
{
  "collection": "users",
  "operation": "find",
  "filter": { "status": ":status" },
  "limit": 100
}
```

รองรับ `operation`: `find`, `findOne`, `aggregate`, `count` — ใช้ `:paramName` ใน filter/pipeline

ตัวอย่าง `options_json` ของ Connection: `{"authSource":"admin","uri":"mongodb://..."}` (ถ้ามี `uri` จะใช้แทน host/port)

## CORS (Frontend คนละ port)

เมนู **CORS** ใน Admin UI — ตั้งค่า origin ที่อนุญาตให้เรียก `/runtime/...` จากเบราว์เซอร์

ตัวอย่าง origin สำหรับ Vite/React:

```
http://localhost:5173
http://127.0.0.1:5173
```

บันทึกแล้วมีผลทันที ไม่ต้อง restart server

```javascript
fetch('http://localhost:3001/runtime/my-group/users', {
  credentials: 'include',
})
  .then((r) => r.json())
  .then(console.log);
```

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
