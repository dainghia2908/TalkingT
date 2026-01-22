const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const conversations = await pool.query(`
            SELECT c.*, 
                   (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar', u.avatar, 'is_online', u.is_online))
                    FROM participants p2 
                    JOIN users u ON p2.user_id = u.id 
                    WHERE p2.conversation_id = c.id) as participants,
                   (SELECT json_build_object('content', m.content, 'created_at', m.created_at, 'sender_id', m.sender_id, 'message_type', m.message_type)
                    FROM messages m 
                    WHERE m.conversation_id = c.id 
                    ORDER BY m.created_at DESC LIMIT 1) as last_message,
                   COALESCE(uc.unread_count, 0) as unread_count
            FROM conversations c
            JOIN participants p ON c.id = p.conversation_id
            LEFT JOIN user_conversations uc ON c.id = uc.conversation_id AND uc.user_id = $1
            WHERE p.user_id = $1
            ORDER BY (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id) DESC NULLS LAST
        `, [req.user.id]);

        res.json({ conversations: conversations.rows });
    } catch (error) {
        console.error('[ERROR] GET /conversations:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { participantIds, name, isGroup } = req.body;
        const allParticipants = [req.user.id, ...participantIds];

        if (!isGroup && allParticipants.length === 2) {
            const existing = await pool.query(`
                SELECT c.id FROM conversations c
                WHERE c.is_group = false
                AND (SELECT COUNT(*) FROM participants WHERE conversation_id = c.id) = 2
                AND EXISTS (SELECT 1 FROM participants WHERE conversation_id = c.id AND user_id = $1)
                AND EXISTS (SELECT 1 FROM participants WHERE conversation_id = c.id AND user_id = $2)
            `, [req.user.id, participantIds[0]]);

            if (existing.rows.length > 0) {
                return res.json({ conversation: { id: existing.rows[0].id }, existing: true });
            }
        }

        const conversation = await pool.query(
            'INSERT INTO conversations (name, is_group, created_by) VALUES ($1, $2, $3) RETURNING *',
            [name || null, isGroup || false, req.user.id]
        );

        for (const participantId of allParticipants) {
            await pool.query(
                'INSERT INTO participants (user_id, conversation_id) VALUES ($1, $2)',
                [participantId, conversation.rows[0].id]
            );
        }

        res.status(201).json({ conversation: conversation.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const conversation = await pool.query(`
            SELECT c.*, 
                   (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar', u.avatar, 'is_online', u.is_online))
                    FROM participants p2 
                    JOIN users u ON p2.user_id = u.id 
                    WHERE p2.conversation_id = c.id) as participants
            FROM conversations c
            WHERE c.id = $1
        `, [req.params.id]);

        if (conversation.rows.length === 0) {
            return res.status(404).json({ message: 'Cuộc hội thoại không tồn tại' });
        }

        res.json({ conversation: conversation.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.get('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const messages = await pool.query(`
            SELECT m.*, u.username as sender_username, u.display_name as sender_display_name, u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
            LIMIT $2 OFFSET $3
        `, [req.params.id, limit, offset]);

        res.json({ messages: messages.rows });
    } catch (error) {
        console.error('[ERROR] GET /messages:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { content, messageType = 'text' } = req.body;

        const message = await pool.query(
            'INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.params.id, req.user.id, content, messageType]
        );

        const fullMessage = await pool.query(`
            SELECT m.*, u.username as sender_username, u.display_name as sender_display_name, u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = $1
        `, [message.rows[0].id]);

        res.status(201).json({ message: fullMessage.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.delete('/:conversationId/messages/:messageId', authMiddleware, async (req, res) => {
    try {
        const { conversationId, messageId } = req.params;

        const message = await pool.query(
            'SELECT * FROM messages WHERE id = $1 AND conversation_id = $2',
            [messageId, conversationId]
        );

        if (message.rows.length === 0) {
            return res.status(404).json({ message: 'Tin nhắn không tồn tại' });
        }

        if (message.rows[0].sender_id !== req.user.id) {
            return res.status(403).json({ message: 'Bạn chỉ có thể xóa tin nhắn của mình' });
        }

        const updated = await pool.query(
            'UPDATE messages SET is_deleted = true WHERE id = $1 RETURNING *',
            [messageId]
        );

        res.json({ message: 'Đã xóa tin nhắn', deletedMessage: updated.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/:id/mark-read', authMiddleware, async (req, res) => {
    try {
        await pool.query(`
            UPDATE user_conversations 
            SET unread_count = 0, last_read_at = NOW()
            WHERE user_id = $1 AND conversation_id = $2
        `, [req.user.id, req.params.id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Tạo nhóm mới
router.post('/group', authMiddleware, async (req, res) => {
    try {
        const { name, memberIds } = req.body;
        const allMembers = [req.user.id, ...memberIds];

        if (allMembers.length < 3) {
            return res.status(400).json({ message: 'Nhóm phải có ít nhất 3 thành viên' });
        }
        if (allMembers.length > 50) {
            return res.status(400).json({ message: 'Nhóm tối đa 50 thành viên' });
        }

        const inviteCode = crypto.randomBytes(16).toString('hex');

        const conversation = await pool.query(`
            INSERT INTO conversations (name, is_group, created_by, invite_code)
            VALUES ($1, true, $2, $3) RETURNING *
        `, [name, req.user.id, inviteCode]);

        for (const memberId of allMembers) {
            const role = memberId === req.user.id ? 'admin' : 'member';
            await pool.query(`
                INSERT INTO participants (user_id, conversation_id, role)
                VALUES ($1, $2, $3)
            `, [memberId, conversation.rows[0].id, role]);

            await pool.query(`
                INSERT INTO user_conversations (user_id, conversation_id, unread_count)
                VALUES ($1, $2, 0)
                ON CONFLICT DO NOTHING
            `, [memberId, conversation.rows[0].id]);
        }

        res.status(201).json({ conversation: conversation.rows[0] });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Thêm thành viên vào nhóm
router.post('/:id/members', authMiddleware, async (req, res) => {
    try {
        const { userIds } = req.body;

        const isAdmin = await pool.query(`
            SELECT 1 FROM participants 
            WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin'
        `, [req.params.id, req.user.id]);

        if (isAdmin.rows.length === 0) {
            return res.status(403).json({ message: 'Chỉ admin mới có thể thêm thành viên' });
        }

        const memberCount = await pool.query(`
            SELECT COUNT(*) FROM participants WHERE conversation_id = $1
        `, [req.params.id]);

        if (parseInt(memberCount.rows[0].count) + userIds.length > 50) {
            return res.status(400).json({ message: 'Nhóm tối đa 50 thành viên' });
        }

        const addedUsers = [];
        for (const userId of userIds) {
            await pool.query(`
                INSERT INTO participants (user_id, conversation_id, role)
                VALUES ($1, $2, 'member')
                ON CONFLICT DO NOTHING
            `, [userId, req.params.id]);

            await pool.query(`
                INSERT INTO user_conversations (user_id, conversation_id, unread_count)
                VALUES ($1, $2, 0)
                ON CONFLICT DO NOTHING
            `, [userId, req.params.id]);

            const userInfo = await pool.query(
                'SELECT display_name, username FROM users WHERE id = $1',
                [userId]
            );
            if (userInfo.rows.length > 0) {
                addedUsers.push(userInfo.rows[0].display_name || userInfo.rows[0].username);
            }
        }

        if (addedUsers.length > 0) {
            const systemMessage = `${addedUsers.join(', ')} đã được thêm vào nhóm`;
            await pool.query(`
                INSERT INTO messages (conversation_id, sender_id, content, message_type)
                VALUES ($1, $2, $3, 'system')
            `, [req.params.id, req.user.id, systemMessage]);
        }

        res.json({ success: true, addedUsers });
    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Xóa thành viên khỏi nhóm
router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
    try {
        const isAdmin = await pool.query(`
            SELECT 1 FROM participants 
            WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin'
        `, [req.params.id, req.user.id]);

        const isSelf = req.params.userId === req.user.id;

        if (isAdmin.rows.length === 0 && !isSelf) {
            return res.status(403).json({ message: 'Không có quyền' });
        }

        await pool.query(`
            DELETE FROM participants 
            WHERE conversation_id = $1 AND user_id = $2
        `, [req.params.id, req.params.userId]);

        await pool.query(`
            DELETE FROM user_conversations 
            WHERE conversation_id = $1 AND user_id = $2
        `, [req.params.id, req.params.userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Lấy invite link
router.get('/:id/invite-link', authMiddleware, async (req, res) => {
    try {
        const conv = await pool.query(`
            SELECT invite_code FROM conversations 
            WHERE id = $1 AND is_group = true
        `, [req.params.id]);

        if (conv.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const inviteLink = `${baseUrl}/join/${conv.rows[0].invite_code}`;

        res.json({ inviteLink, inviteCode: conv.rows[0].invite_code });
    } catch (error) {
        console.error('Get invite link error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Join nhóm bằng invite code
router.post('/join/:inviteCode', authMiddleware, async (req, res) => {
    try {
        const conv = await pool.query(`
            SELECT * FROM conversations WHERE invite_code = $1
        `, [req.params.inviteCode]);

        if (conv.rows.length === 0) {
            return res.status(404).json({ message: 'Link không hợp lệ hoặc đã hết hạn' });
        }

        const existing = await pool.query(`
            SELECT 1 FROM participants 
            WHERE conversation_id = $1 AND user_id = $2
        `, [conv.rows[0].id, req.user.id]);

        if (existing.rows.length > 0) {
            return res.json({ conversation: conv.rows[0], alreadyMember: true });
        }

        const memberCount = await pool.query(`
            SELECT COUNT(*) FROM participants WHERE conversation_id = $1
        `, [conv.rows[0].id]);

        if (parseInt(memberCount.rows[0].count) >= 50) {
            return res.status(400).json({ message: 'Nhóm đã đầy (tối đa 50 thành viên)' });
        }

        await pool.query(`
            INSERT INTO participants (user_id, conversation_id, role)
            VALUES ($1, $2, 'member')
        `, [req.user.id, conv.rows[0].id]);

        await pool.query(`
            INSERT INTO user_conversations (user_id, conversation_id, unread_count)
            VALUES ($1, $2, 0)
            ON CONFLICT DO NOTHING
        `, [req.user.id, conv.rows[0].id]);

        res.json({ conversation: conv.rows[0], joined: true });
    } catch (error) {
        console.error('Join group error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// Lấy thông tin nhóm với danh sách thành viên
router.get('/:id/info', authMiddleware, async (req, res) => {
    try {
        const conv = await pool.query(`
            SELECT c.*, 
                   (SELECT json_agg(json_build_object(
                       'id', u.id, 
                       'username', u.username, 
                       'display_name', u.display_name, 
                       'avatar', u.avatar,
                       'role', p.role,
                       'is_online', u.is_online
                   ))
                   FROM participants p
                   JOIN users u ON p.user_id = u.id
                   WHERE p.conversation_id = c.id) as members
            FROM conversations c
            WHERE c.id = $1
        `, [req.params.id]);

        if (conv.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện' });
        }

        res.json({ conversation: conv.rows[0] });
    } catch (error) {
        console.error('Get group info error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, groupAvatar } = req.body;

        console.log('Update group request:', {
            conversationId: req.params.id,
            userId: req.user.id,
            hasName: !!name,
            hasAvatar: !!groupAvatar,
            avatarLength: groupAvatar?.length
        });

        const isAdmin = await pool.query(`
            SELECT 1 FROM participants 
            WHERE conversation_id = $1 AND user_id = $2 AND role = 'admin'
        `, [req.params.id, req.user.id]);

        if (isAdmin.rows.length === 0) {
            return res.status(403).json({ message: 'Chỉ admin mới có thể chỉnh sửa nhóm' });
        }

        const updated = await pool.query(`
            UPDATE conversations 
            SET name = COALESCE($1, name), 
                avatar = COALESCE($2, avatar)
            WHERE id = $3 
            RETURNING *
        `, [name, groupAvatar, req.params.id]);

        if (updated.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy nhóm' });
        }

        res.json({ conversation: updated.rows[0] });
    } catch (error) {
        console.error('Update group error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ message: 'Lỗi server: ' + error.message });
    }
});

// Get list of users who read a message
router.get('/messages/:messageId/reads', authMiddleware, async (req, res) => {
    try {
        const reads = await pool.query(`
            SELECT u.id, u.username, u.display_name, u.avatar, mr.read_at
            FROM message_reads mr
            JOIN users u ON mr.user_id = u.id
            WHERE mr.message_id = $1
            ORDER BY mr.read_at ASC
        `, [req.params.messageId]);

        res.json({ reads: reads.rows });
    } catch (error) {
        console.error('Get message reads error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// DELETE conversation endpoint - DISABLED
// User requested to remove this feature
/*
router.delete('/:id', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const conversationId = req.params.id;

        const conversation = await client.query(
            'SELECT * FROM conversations WHERE id = $1',
            [conversationId]
        );

        if (conversation.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện' });
        }

        const participant = await client.query(
            'SELECT role FROM participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, req.user.id]
        );

        if (participant.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Bạn không có quyền truy cập cuộc trò chuyện này' });
        }

        // Hard delete: Xóa user khỏi participants
        await client.query(
            'DELETE FROM participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, req.user.id]
        );

        // Xóa user_conversations entry nếu có
        await client.query(
            'DELETE FROM user_conversations WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, req.user.id]
        );

        // Kiểm tra còn participants nào không
        const remaining = await client.query(
            'SELECT COUNT(*) FROM participants WHERE conversation_id = $1',
            [conversationId]
        );

        // Nếu không còn ai, xóa toàn bộ conversation
        if (parseInt(remaining.rows[0].count) === 0) {
            await client.query('DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = $1)', [conversationId]);
            await client.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
            await client.query('DELETE FROM user_conversations WHERE conversation_id = $1', [conversationId]);
            await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Đã xóa cuộc trò chuyện' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete conversation error:', error);
        res.status(500).json({ message: 'Lỗi server' });
    } finally {
        client.release();
    }
});
*/

module.exports = router;
