import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

export default function Sidebar({
    conversations,
    activeConversation,
    onSelectConversation,
    onNewChat,
    onSettings,
    onFriendRequests,
    onCreateGroup,
    currentUser,
    onlineUsers,
    getOtherParticipant,
    requestCount,
    className = '',
}) {
    const [searchQuery, setSearchQuery] = useState('')

    const formatTime = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        const now = new Date()
        const diff = now - date

        if (diff < 86400000) {
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        } else if (diff < 604800000) {
            const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
            return days[date.getDay()]
        } else {
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        }
    }

    const getConversationName = (conv) => {
        if (conv.is_group) return conv.name
        const other = getOtherParticipant(conv)
        return other?.display_name || other?.username || 'Unknown'
    }

    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery.trim()) return true
        const name = getConversationName(conv).toLowerCase()
        const lastMessage = conv.last_message?.content?.toLowerCase() || ''
        return name.includes(searchQuery.toLowerCase()) || lastMessage.includes(searchQuery.toLowerCase())
    })

    const renderAvatar = (conv) => {
        // Handle group avatar
        if (conv.is_group) {
            if (conv.avatar) {
                // Base64 image
                if (conv.avatar.startsWith('data:image')) {
                    return <img src={conv.avatar} alt="" />
                }
                // Emoji or short text
                if (conv.avatar.length <= 4) {
                    return conv.avatar
                }
            }
            // Fallback to first letter of group name
            return conv.name?.charAt(0).toUpperCase() || 'G'
        }

        // Handle personal chat avatar
        const other = getOtherParticipant(conv)
        if (other?.avatar && other.avatar.startsWith('data:')) {
            return <img src={other.avatar} alt="" />
        }
        if (other?.avatar && other.avatar.length <= 4) {
            return other.avatar
        }
        return (other?.display_name || other?.username)?.charAt(0).toUpperCase() || '?'
    }

    const isOnline = (conv) => {
        if (conv.is_group) return false
        const other = getOtherParticipant(conv)
        return other?.is_online || onlineUsers[other?.id]
    }

    return (
        <div className={`sidebar ${className}`}>
            <div className="sidebar-header">
                <h2>TalkingT</h2>
                <div className="header-actions">
                    <button className="icon-btn" onClick={onNewChat} title="Thêm bạn bè">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button className="icon-btn" onClick={onCreateGroup} title="Tạo nhóm">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </button>
                    <button className="icon-btn icon-btn-badge" onClick={onFriendRequests} title="Lời mời kết bạn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        {requestCount > 0 && <span className="badge">{requestCount}</span>}
                    </button>
                    <button className="icon-btn" onClick={onSettings} title="Cài đặt">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="search-box">
                <div className="search-wrapper">
                    <span className="search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="conversations-list">
                {filteredConversations.length === 0 ? (
                    <div className="empty-conversations">
                        <div className="empty-icon">💬</div>
                        <p>{searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có cuộc trò chuyện'}</p>
                        {!searchQuery && <span>Nhấn ➕ để thêm bạn bè</span>}
                    </div>
                ) : (
                    filteredConversations.map(conv => {
                        const hasUnread = conv.unread_count > 0
                        return (
                            <div
                                key={conv.id}
                                className={`conversation-item ${activeConversation?.id === conv.id ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                                onClick={() => onSelectConversation(conv)}
                            >
                                <div className="avatar">
                                    {renderAvatar(conv)}
                                    {isOnline(conv) && <span className="online-indicator"></span>}
                                </div>
                                <div className="conversation-info">
                                    <div className="conversation-name">{getConversationName(conv)}</div>
                                    <div className="conversation-preview">
                                        {conv.last_message?.content || 'Bắt đầu cuộc trò chuyện'}
                                    </div>
                                </div>
                                <div className="conversation-meta">
                                    <span className="conversation-time">
                                        {formatTime(conv.last_message?.created_at)}
                                    </span>
                                    {hasUnread && (
                                        <div className="unread-info">
                                            <span className="unread-badge">{conv.unread_count}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>


        </div>
    )
}
