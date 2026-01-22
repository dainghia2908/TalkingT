const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const users = await pool.query(
            'SELECT id, username, display_name, email, phone, avatar, is_online, last_seen FROM users WHERE id != $1 ORDER BY display_name, username',
            [req.user.id]
        );
        res.json({ users: users.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/search', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        const users = await pool.query(
            `SELECT id, username, display_name, email, phone, avatar, is_online 
             FROM users 
             WHERE id != $1 AND (phone = $2 OR username ILIKE $3 OR display_name ILIKE $3)`,
            [req.user.id, q, `%${q}%`]
        );
        res.json({ users: users.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/search-phone', authMiddleware, async (req, res) => {
    try {
        const { phone } = req.query;
        const user = await pool.query(
            'SELECT id, username, display_name, phone, avatar, bio, is_online FROM users WHERE phone = $1 AND id != $2',
            [phone, req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng với số điện thoại này' });
        }

        const friendship = await pool.query(
            'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, user.rows[0].id]
        );

        res.json({
            user: user.rows[0],
            friendStatus: friendship.rows.length > 0 ? friendship.rows[0].status : null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const user = await pool.query(
            'SELECT id, username, display_name, email, phone, avatar, is_online, last_seen FROM users WHERE id = $1',
            [req.params.id]
        );
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User không tồn tại' });
        }
        res.json({ user: user.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { displayName, phone, avatar, bio } = req.body;

        if (phone) {
            const phoneExists = await pool.query(
                'SELECT id FROM users WHERE phone = $1 AND id != $2',
                [phone, req.user.id]
            );
            if (phoneExists.rows.length > 0) {
                return res.status(400).json({ message: 'Số điện thoại đã được sử dụng' });
            }
        }

        const updatedUser = await pool.query(
            `UPDATE users 
             SET display_name = COALESCE($1, display_name), 
                 phone = COALESCE($2, phone), 
                 avatar = COALESCE($3, avatar), 
                 bio = COALESCE($4, bio),
                 profile_completed = true 
             WHERE id = $5 
             RETURNING id, username, display_name, email, phone, avatar, bio, profile_completed`,
            [displayName, phone, avatar, bio, req.user.id]
        );

        res.json({ user: updatedUser.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/friend-request', authMiddleware, async (req, res) => {
    try {
        const { friendId } = req.body;

        const existing = await pool.query(
            'SELECT * FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, friendId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'Đã gửi lời mời hoặc đã là bạn bè' });
        }

        await pool.query(
            'INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3)',
            [req.user.id, friendId, 'pending']
        );

        res.json({ message: 'Đã gửi lời mời kết bạn' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.put('/friend-request/:id/accept', authMiddleware, async (req, res) => {
    try {
        await pool.query(
            'UPDATE friends SET status = $1 WHERE friend_id = $2 AND user_id = $3',
            ['accepted', req.user.id, req.params.id]
        );
        res.json({ message: 'Đã chấp nhận lời mời kết bạn' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.delete('/friend-request/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, req.params.id]
        );
        res.json({ message: 'Đã hủy/từ chối lời mời kết bạn' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/friends/list', authMiddleware, async (req, res) => {
    try {
        const friends = await pool.query(`
            SELECT u.id, u.username, u.display_name, u.phone, u.avatar, u.bio, u.is_online
            FROM users u
            JOIN friends f ON (f.friend_id = u.id OR f.user_id = u.id)
            WHERE ((f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted' AND u.id != $1)
        `, [req.user.id]);

        res.json({ friends: friends.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/friends/requests', authMiddleware, async (req, res) => {
    try {
        const requests = await pool.query(`
            SELECT u.id, u.username, u.display_name, u.phone, u.avatar, f.created_at
            FROM users u
            JOIN friends f ON f.user_id = u.id
            WHERE f.friend_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        res.json({ requests: requests.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/friends/sent', authMiddleware, async (req, res) => {
    try {
        const sent = await pool.query(`
            SELECT u.id, u.username, u.display_name, u.phone, u.avatar, f.created_at
            FROM users u
            JOIN friends f ON f.friend_id = u.id
            WHERE f.user_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        res.json({ sent: sent.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.delete('/friends/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [req.user.id, req.params.id]
        );
        res.json({ message: 'Đã hủy kết bạn' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;
