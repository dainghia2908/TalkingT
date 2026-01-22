const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (!hasLetter || !hasNumber) {
            return res.status(400).json({ message: 'Mật khẩu phải chứa cả chữ và số' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        const usernameExists = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (usernameExists.rows.length > 0) {
            return res.status(400).json({ message: 'Tên người dùng đã tồn tại' });
        }

        const emailExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (emailExists.rows.length > 0) {
            return res.status(400).json({ message: 'Email đã được sử dụng' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
            [username, email, passwordHash]
        );

        res.status(201).json({
            message: 'Đăng ký thành công! Vui lòng đăng nhập.',
            success: true
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Email không tồn tại' });
        }

        const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu không đúng' });
        }

        await pool.query('UPDATE users SET is_online = true WHERE id = $1', [user.rows[0].id]);

        const token = jwt.sign(
            { id: user.rows[0].id, username: user.rows[0].username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Đăng nhập thành công',
            user: {
                id: user.rows[0].id,
                username: user.rows[0].username,
                display_name: user.rows[0].display_name,
                email: user.rows[0].email,
                phone: user.rows[0].phone,
                avatar: user.rows[0].avatar,
                profile_completed: user.rows[0].profile_completed
            },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/me', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Không có token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query(
            'SELECT id, username, display_name, email, phone, avatar, bio, is_online, profile_completed, created_at FROM users WHERE id = $1',
            [decoded.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User không tồn tại' });
        }

        res.json({ user: user.rows[0] });
    } catch (error) {
        res.status(401).json({ message: 'Token không hợp lệ' });
    }
});

module.exports = router;
