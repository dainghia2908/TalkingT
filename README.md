# Chat Application - Real-time Messaging

Ứng dụng chat real-time với React, Node.js, Socket.IO và PostgreSQL.

## Yêu cầu hệ thống

- Node.js 16+
- PostgreSQL 14+
- npm hoặc yarn

## Cài đặt

### 1. Clone repository và cài đặt dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Cấu hình database

**Tạo database trong PostgreSQL:**

```sql
CREATE DATABASE chat_app;
```

**Cập nhật thông tin database:**

Mở file `server/config/db.js` và thay đổi:
- `user`: tên user PostgreSQL của bạn (mặc định: `postgres`)
- `password`: mật khẩu PostgreSQL của bạn
- `database`: `chat_app`

```javascript
const pool = new Pool({
    user: 'postgres',        // <-- Đổi thành user của bạn
    host: 'localhost',
    database: 'chat_app',
    password: 'your_password', // <-- Đổi password ở đây
    port: 5432
})
```

### 3. Chạy migrations

**Trong pgAdmin hoặc terminal PostgreSQL, chạy các file migration theo thứ tự:**

```bash
# Option 1: Chạy file tổng hợp
psql -U postgres -d chat_app -f database.sql
psql -U postgres -d chat_app -f server/migrations/004_message_reads.sql
psql -U postgres -d chat_app -f server/migrations/005_participants_role.sql

# Option 2: Copy paste SQL vào pgAdmin
# Mở từng file và chạy trong pgAdmin Query Tool
```

### 4. Chạy ứng dụng

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

Ứng dụng sẽ chạy tại:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Tính năng

- ✅ Đăng ký / Đăng nhập
- ✅ Chat 1-1 real-time
- ✅ Group chat
- ✅ Gửi file, ảnh, video
- ✅ Voice & Video call (WebRTC)
- ✅ Quản lý bạn bè
- ✅ Online status
- ✅ Read receipts
- ✅ Typing indicators

## Cấu trúc project

```
Chat/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/        # Page components
│   │   └── index.css     # Styles
│   └── package.json
│
├── server/                # Node.js backend
│   ├── config/           # Database config
│   ├── middleware/       # Auth middleware
│   ├── routes/          # API routes
│   ├── socket/          # Socket.IO handlers
│   ├── migrations/      # Database migrations
│   └── package.json
│
└── database.sql         # Initial database schema
```

## Troubleshooting

**Lỗi kết nối database:**
- Kiểm tra PostgreSQL đang chạy
- Kiểm tra username/password trong `server/config/db.js`
- Kiểm tra database `chat_app` đã được tạo

**Lỗi port đã được sử dụng:**
- Backend (5000): Đổi port trong `server/server.js`
- Frontend (5173): Đổi port trong `client/vite.config.js`

**Avatar không hiển thị:**
- Tạo folder `server/uploads/avatars`
- Restart backend server

## License

MIT
