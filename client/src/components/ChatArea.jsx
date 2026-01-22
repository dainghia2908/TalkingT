import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000'

const STICKERS = [
    '😀', '😂', '😍', '🥰', '😎', '🤩', '😇', '🤗',
    '😭', '😤', '😱', '🤯', '😴', '🤔', '😏', '🙄',
    '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤟', '👊',
    '❤️', '💕', '💖', '💗', '💙', '💚', '💛', '🧡',
    '🎉', '🎊', '🎁', '🎈', '⭐', '🌟', '✨', '💫',
    '🔥', '💯', '✅', '❌', '⚡', '💪', '🚀', '🏆'
]

export default function ChatArea({
    conversation,
    messages,
    currentUser,
    onSendMessage,
    onTyping,
    typingUsers,
    getOtherParticipant,
    onlineUsers,
    onStartCall,
    onDeleteMessage,
    onBackToList,
    onGroupInfo,
    className = ''
}) {
    const [message, setMessage] = useState('')
    const [showStickers, setShowStickers] = useState(false)
    const [showAttachMenu, setShowAttachMenu] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, messageId: null })
    const [mediaViewer, setMediaViewer] = useState({ show: false, type: '', url: '', filename: '' })
    const messagesEndRef = useRef(null)
    const typingTimeoutRef = useRef(null)
    const fileInputRef = useRef(null)
    const imageInputRef = useRef(null)

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        const handleClickOutside = () => {
            setShowStickers(false)
            setShowAttachMenu(false)
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleInputChange = (e) => {
        setMessage(e.target.value)
        onTyping(true)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
            onTyping(false)
        }, 1000)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!message.trim()) return
        onSendMessage(message)
        setMessage('')
        onTyping(false)
        clearTimeout(typingTimeoutRef.current)
    }

    const handleSendSticker = (sticker) => {
        onSendMessage(sticker, 'sticker')
        setShowStickers(false)
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            alert('File quá lớn (tối đa 10MB)')
            return
        }

        setUploading(true)
        setShowAttachMenu(false)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const token = localStorage.getItem('token')
            const res = await axios.post(`${API_URL}/api/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            })

            const content = JSON.stringify({
                url: res.data.url,
                filename: res.data.filename,
                type: res.data.type,
                size: res.data.size
            })
            onSendMessage(content, res.data.type)
        } catch (error) {
            console.error('Upload error:', error)
            alert(error.response?.data?.message || 'Lỗi upload file')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    const formatMessageTime = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) {
            return 'Hôm nay'
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Hôm qua'
        } else {
            return date.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            })
        }
    }

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const shouldShowDate = (currentMsg, prevMsg) => {
        if (!prevMsg) return true
        const currDate = new Date(currentMsg.created_at).toDateString()
        const prevDate = new Date(prevMsg.created_at).toDateString()
        return currDate !== prevDate
    }

    const renderAvatar = (user) => {
        // If it's a group conversation, use group avatar
        if (conversation.is_group) {
            if (conversation.avatar) {
                if (conversation.avatar.startsWith('data:image')) {
                    return <img src={conversation.avatar} alt="" />
                }
                if (conversation.avatar.length <= 4) {
                    return conversation.avatar
                }
            }
            return conversation.name?.charAt(0).toUpperCase() || 'G'
        }

        // Personal chat avatar
        if (user?.avatar && user.avatar.startsWith('data:')) {
            return <img src={user.avatar} alt="" />
        }
        if (user?.avatar && user.avatar.length <= 4) {
            return user.avatar
        }
        return (user?.display_name || user?.username)?.charAt(0).toUpperCase() || '?'
    }

    const renderMessageContent = (msg) => {
        if (msg.is_deleted) {
            return <div className="message-deleted">Tin nhắn đã bị xóa</div>
        }

        if (msg.message_type === 'sticker') {
            return <div className="message-sticker">{msg.content}</div>
        }

        if (msg.message_type === 'call') {
            const isVideoCall = msg.content.includes('video')
            const isMissed = msg.content.includes('Không trả lời') || msg.content.includes('Đã hủy')
            return (
                <div className={`message-call ${isMissed ? 'missed' : ''}`}>
                    <span className="call-icon">
                        {isVideoCall ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                        )}
                    </span>
                    <span className="call-text">{msg.content}</span>
                </div>
            )
        }

        if (msg.message_type === 'image' || msg.message_type === 'file' || msg.message_type === 'video' || msg.message_type === 'audio') {
            try {
                const data = JSON.parse(msg.content)

                if (msg.message_type === 'image') {
                    return (
                        <div className="message-image">
                            <img
                                src={`${API_URL}${data.url}`}
                                alt={data.filename}
                                onClick={() => setMediaViewer({
                                    show: true,
                                    type: 'image',
                                    url: `${API_URL}${data.url}`,
                                    filename: data.filename
                                })}
                            />
                        </div>
                    )
                }

                if (msg.message_type === 'video') {
                    return (
                        <div className="message-video">
                            <video
                                src={`${API_URL}${data.url}`}
                                onClick={() => setMediaViewer({
                                    show: true,
                                    type: 'video',
                                    url: `${API_URL}${data.url}`,
                                    filename: data.filename
                                })}
                            />
                            <div className="video-play-overlay" onClick={() => setMediaViewer({
                                show: true,
                                type: 'video',
                                url: `${API_URL}${data.url}`,
                                filename: data.filename
                            })}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                            </div>
                        </div>
                    )
                }

                if (msg.message_type === 'audio') {
                    return (
                        <div className="message-audio">
                            <audio controls src={`${API_URL}${data.url}`} />
                        </div>
                    )
                }

                return (
                    <div className="message-file">
                        <a href={`${API_URL}${data.url}`} download={data.filename} className="file-link">
                            <span className="file-icon-box">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </span>
                            <div className="file-info">
                                <span className="file-name">{data.filename}</span>
                                <span className="file-size">{formatFileSize(data.size)}</span>
                            </div>
                            <span className="file-download-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </span>
                        </a>
                    </div>
                )
            } catch {
                return <div className="message-content">{msg.content}</div>
            }
        }

        return <div className="message-content">{msg.content}</div>
    }

    if (!conversation) {
        return (
            <div className={`chat-area ${className}`}>
                <div className="empty-chat">
                    <div className="empty-chat-icon">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <h3>Chào mừng đến TalkingT</h3>
                    <p>Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
                </div>
            </div>
        )
    }


    const otherUser = getOtherParticipant(conversation)
    const isOtherOnline = otherUser?.is_online || onlineUsers[otherUser?.id]
    const typingUsersList = Object.values(typingUsers)

    return (
        <div className={`chat-area ${className}`}>
            <div className={`chat-header ${className}`}>
                {onBackToList && (
                    <button className="back-btn mobile-only" onClick={onBackToList} style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                )}
                <div className="chat-user-info">
                    <div className="avatar">
                        {renderAvatar(otherUser)}
                        {isOtherOnline && <span className="online-indicator"></span>}
                    </div>
                    <div className="chat-user-details">
                        <div className="chat-user-name">
                            {conversation.is_group ? conversation.name : (otherUser?.display_name || otherUser?.username)}
                        </div>
                        <div className={`chat-user-status ${isOtherOnline ? 'online' : ''}`}>
                            {typingUsersList.length > 0
                                ? `${typingUsersList.join(', ')} đang nhập...`
                                : isOtherOnline ? 'Đang hoạt động' : 'Offline'}
                        </div>
                    </div>
                </div>
                <div className="chat-header-actions">
                    {conversation.is_group && (
                        <button className="icon-btn" title="Thông tin nhóm" onClick={() => onGroupInfo && onGroupInfo()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </button>
                    )}
                    <button className="icon-btn" title="Gọi thoại" onClick={() => onStartCall && onStartCall('audio')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                    <button className="icon-btn" title="Gọi video" onClick={() => onStartCall && onStartCall('video')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="messages-container" onClick={() => setContextMenu({ show: false, x: 0, y: 0, messageId: null })}>
                {messages.map((msg, index) => (
                    <div key={msg.id}>
                        {shouldShowDate(msg, messages[index - 1]) && (
                            <div className="date-separator">
                                <span>{formatDate(msg.created_at)}</span>
                            </div>
                        )}
                        <div className={`message-row ${msg.sender_id === currentUser?.id ? 'sent' : 'received'}`}>
                            {msg.sender_id !== currentUser?.id && (
                                <div className="avatar message-avatar">
                                    {renderAvatar({ avatar: msg.sender_avatar, username: msg.sender_username })}
                                </div>
                            )}
                            <div className="message-wrapper">
                                {conversation.is_group && msg.sender_id !== currentUser?.id && (
                                    <div className="sender-name">{msg.sender_display_name || msg.sender_username}</div>
                                )}
                                <div className="message-bubble">
                                    {renderMessageContent(msg)}
                                    <div className="message-time">{formatMessageTime(msg.created_at)}</div>
                                </div>
                                {msg.sender_id === currentUser?.id && !msg.is_deleted && (
                                    <button
                                        className="message-menu-btn"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setContextMenu({
                                                show: !contextMenu.show || contextMenu.messageId !== msg.id,
                                                x: e.clientX,
                                                y: e.clientY,
                                                messageId: msg.id
                                            })
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <circle cx="12" cy="5" r="2"></circle>
                                            <circle cx="12" cy="12" r="2"></circle>
                                            <circle cx="12" cy="19" r="2"></circle>
                                        </svg>
                                    </button>
                                )}
                                {/* Read status - dưới tin nhắn cuối cùng */}
                                {msg.sender_id === currentUser?.id && index === messages.length - 1 && (
                                    <div className="read-status">
                                        {msg.is_read ? '✓ Đã đọc' : '✓ Đã gửi'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />

                {contextMenu.show && (
                    <div
                        className="context-menu"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="context-menu-item delete"
                            onClick={() => {
                                onDeleteMessage && onDeleteMessage(contextMenu.messageId)
                                setContextMenu({ show: false, x: 0, y: 0, messageId: null })
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Xóa tin nhắn
                        </button>
                    </div>
                )}
            </div>

            <div className="chat-input-container">
                {showStickers && (
                    <div className="sticker-picker" onClick={e => e.stopPropagation()}>
                        <div className="sticker-grid">
                            {STICKERS.map((sticker, index) => (
                                <button key={index} className="sticker-item" onClick={() => handleSendSticker(sticker)}>
                                    {sticker}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {showAttachMenu && (
                    <div className="attach-menu" onClick={e => e.stopPropagation()}>
                        <button className="attach-option" onClick={() => imageInputRef.current?.click()}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            Ảnh / Video
                        </button>
                        <button className="attach-option" onClick={() => fileInputRef.current?.click()}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            Tài liệu
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="chat-input-wrapper">
                    <button
                        type="button"
                        className="input-action-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowAttachMenu(!showAttachMenu)
                            setShowStickers(false)
                        }}
                        title="Đính kèm"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                    </button>
                    <button
                        type="button"
                        className="input-action-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowStickers(!showStickers)
                            setShowAttachMenu(false)
                        }}
                        title="Sticker"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                    </button>
                    <input
                        type="text"
                        className="chat-input"
                        placeholder={uploading ? "Đang tải lên..." : "Nhập tin nhắn..."}
                        value={message}
                        onChange={handleInputChange}
                        disabled={uploading}
                    />
                    <button type="submit" className="send-btn" disabled={!message.trim() || uploading}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </form>

                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
            </div>

            {mediaViewer.show && (
                <div className="media-viewer-overlay" onClick={() => setMediaViewer({ show: false, type: '', url: '', filename: '' })}>
                    <div className="media-viewer-header">
                        <span className="media-filename">{mediaViewer.filename}</span>
                        <div className="media-actions">
                            <a
                                href={mediaViewer.url}
                                download={mediaViewer.filename}
                                className="download-btn"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </a>
                            <button className="close-viewer-btn" onClick={() => setMediaViewer({ show: false, type: '', url: '', filename: '' })}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="media-viewer-content" onClick={(e) => e.stopPropagation()}>
                        {mediaViewer.type === 'image' ? (
                            <img src={mediaViewer.url} alt={mediaViewer.filename} />
                        ) : (
                            <video src={mediaViewer.url} controls autoPlay />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
