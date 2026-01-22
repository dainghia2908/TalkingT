const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const onlineUsers = new Map();

const socketHandler = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`User connected: ${socket.user.username}`);

        onlineUsers.set(socket.user.id, socket.id);

        await pool.query('UPDATE users SET is_online = true WHERE id = $1', [socket.user.id]);

        io.emit('user_status', { userId: socket.user.id, isOnline: true });

        const conversations = await pool.query(
            'SELECT conversation_id FROM participants WHERE user_id = $1',
            [socket.user.id]
        );
        conversations.rows.forEach(row => {
            socket.join(row.conversation_id);
        });

        socket.on('send_message', async (data) => {
            try {
                const { conversationId, content, messageType = 'text' } = data;

                const message = await pool.query(
                    'INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
                    [conversationId, socket.user.id, content, messageType]
                );

                const fullMessage = await pool.query(`
                    SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = $1
                `, [message.rows[0].id]);

                io.to(conversationId).emit('new_message', fullMessage.rows[0]);

                // Lấy danh sách participants
                const participants = await pool.query(
                    'SELECT user_id FROM participants WHERE conversation_id = $1',
                    [conversationId]
                );

                // INSERT hoặc UPDATE unread count cho mỗi participant (trừ sender)
                for (const p of participants.rows) {
                    if (p.user_id !== socket.user.id) {
                        await pool.query(`
                            INSERT INTO user_conversations (user_id, conversation_id, unread_count)
                            VALUES ($1, $2, 1)
                            ON CONFLICT (user_id, conversation_id)
                            DO UPDATE SET unread_count = user_conversations.unread_count + 1
                        `, [p.user_id, conversationId]);
                    }
                }
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('error', { message: 'Không thể gửi tin nhắn' });
            }
        });

        socket.on('typing', (data) => {
            socket.to(data.conversationId).emit('user_typing', {
                conversationId: data.conversationId,
                userId: socket.user.id,
                username: socket.user.username,
                isTyping: data.isTyping
            });
        });

        socket.on('join_conversation', (conversationId) => {
            socket.join(conversationId);
        });

        socket.on('leave_conversation', (conversationId) => {
            socket.leave(conversationId);
        });

        socket.on('mark_read', async (data) => {
            try {
                // Get all unread messages in this conversation
                const unreadMessages = await pool.query(
                    'SELECT id FROM messages WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false',
                    [data.conversationId, socket.user.id]
                );

                // Mark messages as read
                await pool.query(
                    'UPDATE messages SET is_read = true WHERE conversation_id = $1 AND sender_id != $2',
                    [data.conversationId, socket.user.id]
                );

                // Insert into message_reads for each message
                for (const msg of unreadMessages.rows) {
                    await pool.query(
                        'INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [msg.id, socket.user.id]
                    );
                }

                // Reset unread count
                await pool.query(`
                    UPDATE user_conversations 
                    SET unread_count = 0, last_read_at = NOW()
                    WHERE conversation_id = $1 AND user_id = $2
                `, [data.conversationId, socket.user.id]);

                socket.to(data.conversationId).emit('messages_read', {
                    conversationId: data.conversationId,
                    readBy: socket.user.id
                });
            } catch (error) {
                console.error('Mark read error:', error);
            }
        });

        socket.on('call_user', (data) => {
            console.log(`📞 Call from ${socket.user.username} to conversation ${data.conversationId}`);

            // Get all sockets in the conversation room
            const room = io.sockets.adapter.rooms.get(data.conversationId);
            console.log(`Room ${data.conversationId} has ${room ? room.size : 0} members`);

            socket.to(data.conversationId).emit('incoming_call', {
                from: socket.user,
                callType: data.callType,
                offer: data.offer,
                conversationId: data.conversationId
            });

            console.log(`Emitted incoming_call to room ${data.conversationId}`);
        });

        socket.on('accept_call', (data) => {
            socket.to(data.conversationId).emit('call_accepted', {
                answer: data.answer
            });
        });

        socket.on('reject_call', async (data) => {
            const { conversationId, callerId, callType } = data;

            // Emit rejected event to specific user (caller) to handle specific UI logic if needed
            socket.to(conversationId).emit('call_rejected', {
                from: socket.user.id
            });

            // Create "Call ended" message attributed to caller
            const callMessage = callType === 'video'
                ? 'Cuộc gọi video - Đã kết thúc'
                : 'Cuộc gọi thoại - Đã kết thúc';

            // Sender is the original caller
            const senderId = callerId;

            try {
                if (senderId) {
                    const result = await pool.query(
                        `INSERT INTO messages (conversation_id, sender_id, content, message_type) 
                         VALUES ($1, $2, $3, $4) 
                         RETURNING *`,
                        [conversationId, senderId, callMessage, 'call']
                    );

                    const message = await pool.query(`
                        SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
                        FROM messages m
                        JOIN users u ON m.sender_id = u.id
                        WHERE m.id = $1
                    `, [result.rows[0].id]);

                    io.to(conversationId).emit('new_message', message.rows[0]);
                }

                // Signal everyone to close call UI
                io.to(conversationId).emit('call_ended');

            } catch (error) {
                console.error('Reject call error:', error);
            }
        });

        socket.on('call_timeout', async (data) => {
            const { conversationId, callType } = data;
            const callMessage = callType === 'video'
                ? 'Cuộc gọi video - Không trả lời'
                : 'Cuộc gọi thoại - Không trả lời';

            try {
                const result = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, content, message_type) 
                     VALUES ($1, $2, $3, $4) 
                     RETURNING *`,
                    [conversationId, socket.user.id, callMessage, 'call']
                );

                const message = await pool.query(`
                    SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = $1
                `, [result.rows[0].id]);

                io.to(conversationId).emit('new_message', message.rows[0]);

                // Signal everyone to close call UI
                io.to(conversationId).emit('call_ended');
            } catch (error) {
                console.error('Call timeout error:', error);
            }
        });

        socket.on('call_cancelled', async (data) => {
            const { conversationId, callType } = data;
            const callMessage = callType === 'video'
                ? 'Cuộc gọi video - Đã hủy'
                : 'Cuộc gọi thoại - Đã hủy';

            try {
                const result = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, content, message_type) 
                     VALUES ($1, $2, $3, $4) 
                     RETURNING *`,
                    [conversationId, socket.user.id, callMessage, 'call']
                );

                const message = await pool.query(`
                    SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = $1
                `, [result.rows[0].id]);

                io.to(conversationId).emit('new_message', message.rows[0]);

                // Signal everyone to close call UI
                io.to(conversationId).emit('call_ended');
            } catch (error) {
                console.error('Call cancelled error:', error);
            }
        });

        socket.on('call_ended', async (data) => {
            const { conversationId, callType, duration, callerId } = data;

            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            const durationStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            const callMessage = callType === 'video'
                ? `Cuộc gọi video - ${durationStr}`
                : `Cuộc gọi thoại - ${durationStr}`;

            // Use callerId if provided, otherwise fallback to socket.user.id
            const senderId = callerId || socket.user.id;

            try {
                const result = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, content, message_type) 
                     VALUES ($1, $2, $3, $4) 
                     RETURNING *`,
                    [conversationId, senderId, callMessage, 'call']
                );

                const message = await pool.query(`
                    SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = $1
                `, [result.rows[0].id]);

                // Emit new_message with full user details
                io.to(conversationId).emit('new_message', message.rows[0]);

                // IMPORTANT: Emit to ALL users in room
                io.to(conversationId).emit('call_ended');
            } catch (error) {
                console.error('Call ended error:', error);
            }
        });



        socket.on('ice_candidate', (data) => {
            socket.to(data.conversationId).emit('ice_candidate', {
                candidate: data.candidate
            });
        });



        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.user.username}`);
            onlineUsers.delete(socket.user.id);

            await pool.query(
                'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [socket.user.id]
            );

            io.emit('user_status', { userId: socket.user.id, isOnline: false });
        });
    });
};

module.exports = socketHandler;
