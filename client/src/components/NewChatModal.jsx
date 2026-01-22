import { useState } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

export default function NewChatModal({ onClose, onStartChat, currentUser }) {
    const [phone, setPhone] = useState('')
    const [foundUser, setFoundUser] = useState(null)
    const [friendStatus, setFriendStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showDetail, setShowDetail] = useState(false)
    const [selectedFriend, setSelectedFriend] = useState(null)
    const [friends, setFriends] = useState([])
    const [sentRequests, setSentRequests] = useState([])
    const [activeTab, setActiveTab] = useState('friends')

    const fetchFriends = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/friends/list`)
            setFriends(res.data.friends)
        } catch (error) {
            console.error('Fetch friends error:', error)
        }
    }

    const fetchSentRequests = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/friends/sent`)
            setSentRequests(res.data.sent)
        } catch (error) {
            console.error('Fetch sent requests error:', error)
        }
    }

    const handleTabChange = (tab) => {
        setActiveTab(tab)
        setShowDetail(false)
        setSelectedFriend(null)
        setSearched(false)
        setFoundUser(null)
        setPhone('')
        if (tab === 'friends') {
            fetchFriends()
        } else if (tab === 'sent') {
            fetchSentRequests()
        }
    }

    useState(() => {
        fetchFriends()
    }, [])

    const handleSearch = async () => {
        if (!phone.trim()) return

        setLoading(true)
        setError('')
        setSuccess('')
        setFoundUser(null)
        setSearched(true)
        setShowDetail(false)

        try {
            const res = await axios.get(`${API_URL}/users/search-phone?phone=${phone}`)
            setFoundUser(res.data.user)
            setFriendStatus(res.data.friendStatus)
        } catch (err) {
            setFoundUser(null)
        } finally {
            setLoading(false)
        }
    }

    const handleAddFriend = async () => {
        if (!foundUser) return

        try {
            await axios.post(`${API_URL}/users/friend-request`, { friendId: foundUser.id })
            setSuccess('Đã gửi lời mời kết bạn!')
            setFriendStatus('pending')
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra')
        }
    }

    const handleUnfriend = async (userId) => {
        try {
            await axios.delete(`${API_URL}/users/friends/${userId}`)
            setFriends(prev => prev.filter(f => f.id !== userId))
            setShowDetail(false)
            setSelectedFriend(null)
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra')
        }
    }

    const handleCancelRequest = async (userId) => {
        try {
            await axios.delete(`${API_URL}/users/friend-request/${userId}`)
            setSentRequests(prev => prev.filter(r => r.id !== userId))
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra')
        }
    }

    const handleStartChat = (userId) => {
        onStartChat(userId || foundUser?.id)
    }

    const handleViewFriend = (friend) => {
        setSelectedFriend(friend)
        setShowDetail(true)
    }

    const renderAvatar = (user) => {
        if (user.avatar && user.avatar.startsWith('data:')) {
            return <img src={user.avatar} alt={user.display_name} />
        }
        if (user.avatar && user.avatar.length <= 4) {
            return user.avatar
        }
        return (user.display_name || user.username)?.charAt(0).toUpperCase() || '?'
    }

    const renderUserDetail = (user, isFriend = false) => (
        <div className="user-detail-card">
            <button className="btn-back" onClick={() => {
                setShowDetail(false)
                setSelectedFriend(null)
            }}>
                ← Quay lại
            </button>
            <div className="detail-avatar">
                {renderAvatar(user)}
            </div>
            <div className="detail-name">{user.display_name || user.username}</div>
            <div className="detail-phone">📱 {user.phone}</div>
            {user.bio && (
                <div className="detail-bio">
                    <span className="bio-label">Mô tả:</span>
                    <p>{user.bio}</p>
                </div>
            )}
            <div className="detail-actions">
                {isFriend ? (
                    <>
                        <button className="btn btn-primary" onClick={() => handleStartChat(user.id)}>
                            💬 Nhắn tin
                        </button>
                        <button
                            className="btn-unfriend"
                            onClick={() => handleUnfriend(user.id)}
                            style={{ marginTop: '10px' }}
                        >
                            Hủy kết bạn
                        </button>
                    </>
                ) : friendStatus === 'accepted' ? (
                    <button className="btn btn-primary" onClick={() => handleStartChat()}>
                        💬 Nhắn tin
                    </button>
                ) : friendStatus === 'pending' ? (
                    <button className="btn" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }} disabled>
                        Đã gửi lời mời
                    </button>
                ) : (
                    <button className="btn btn-primary" onClick={handleAddFriend}>
                        ➕ Kết bạn
                    </button>
                )}
            </div>
        </div>
    )

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <h3>Trò chuyện</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-tabs three-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'friends' ? 'active' : ''}`}
                        onClick={() => handleTabChange('friends')}
                    >
                        👥 Bạn bè
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'search' ? 'active' : ''}`}
                        onClick={() => handleTabChange('search')}
                    >
                        🔍 Tìm
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'sent' ? 'active' : ''}`}
                        onClick={() => handleTabChange('sent')}
                    >
                        📤 Đã gửi
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'friends' && !showDetail && (
                        <div className="friends-list">
                            {friends.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">👥</div>
                                    <p>Chưa có bạn bè</p>
                                </div>
                            ) : (
                                friends.map(friend => (
                                    <div
                                        key={friend.id}
                                        className="friend-item"
                                        onClick={() => handleViewFriend(friend)}
                                    >
                                        <div className="friend-avatar">
                                            {renderAvatar(friend)}
                                            {friend.is_online && <span className="online-indicator"></span>}
                                        </div>
                                        <div className="friend-info">
                                            <div className="friend-name">{friend.display_name || friend.username}</div>
                                            <div className="friend-phone">{friend.phone}</div>
                                        </div>
                                        <span className="chat-arrow">→</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'friends' && showDetail && selectedFriend && renderUserDetail(selectedFriend, true)}

                    {activeTab === 'search' && !showDetail && (
                        <>
                            <div className="search-section">
                                <div className="search-input-group">
                                    <input
                                        type="tel"
                                        className="phone-input"
                                        placeholder="Nhập số điện thoại..."
                                        value={phone}
                                        onChange={(e) => {
                                            setPhone(e.target.value.replace(/\D/g, ''))
                                            setSearched(false)
                                            setFoundUser(null)
                                            setError('')
                                            setSuccess('')
                                        }}
                                        maxLength={11}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                    <button
                                        className="search-btn"
                                        onClick={handleSearch}
                                        disabled={loading || !phone.trim()}
                                    >
                                        {loading ? '...' : '🔍'}
                                    </button>
                                </div>
                            </div>

                            {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}
                            {success && <div className="success-message" style={{ marginTop: '16px' }}>{success}</div>}

                            {searched && !loading && foundUser && (
                                <div className="search-result" style={{ marginTop: '20px' }}>
                                    <div className="user-card">
                                        <div className="user-card-avatar">
                                            {renderAvatar(foundUser)}
                                        </div>
                                        <div className="user-card-info">
                                            <div className="user-card-name">{foundUser.display_name || foundUser.username}</div>
                                            <div className="user-card-phone">📱 {foundUser.phone}</div>
                                        </div>
                                        <button
                                            className="btn-detail"
                                            onClick={() => setShowDetail(true)}
                                            title="Xem chi tiết"
                                        >
                                            ℹ️
                                        </button>
                                    </div>

                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        {friendStatus === 'accepted' ? (
                                            <button className="btn-action btn-chat" style={{ flex: 1 }} onClick={() => handleStartChat()}>
                                                💬 Nhắn tin
                                            </button>
                                        ) : friendStatus === 'pending' ? (
                                            <button className="btn-action btn-pending" style={{ flex: 1 }} disabled>
                                                Đã gửi lời mời
                                            </button>
                                        ) : (
                                            <button className="btn-action btn-add" style={{ flex: 1 }} onClick={handleAddFriend}>
                                                ➕ Kết bạn
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {searched && !loading && !foundUser && (
                                <div className="no-result" style={{ marginTop: '20px' }}>
                                    <div className="no-result-icon">😕</div>
                                    <p>Không tìm thấy người dùng</p>
                                    <span>Kiểm tra lại số điện thoại</span>
                                </div>
                            )}

                            {!searched && (
                                <div className="search-hint">
                                    <div className="hint-icon">🔍</div>
                                    <p>Tìm bạn bè qua số điện thoại</p>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'search' && showDetail && foundUser && renderUserDetail(foundUser, false)}

                    {activeTab === 'sent' && (
                        <div className="sent-requests-list">
                            {sentRequests.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">📤</div>
                                    <p>Chưa gửi lời mời nào</p>
                                </div>
                            ) : (
                                sentRequests.map(request => (
                                    <div key={request.id} className="request-item">
                                        <div className="request-avatar">
                                            {renderAvatar(request)}
                                        </div>
                                        <div className="request-info">
                                            <div className="request-name">{request.display_name || request.username}</div>
                                            <div className="request-time">Đang chờ phản hồi</div>
                                        </div>
                                        <button
                                            className="btn-cancel"
                                            onClick={() => handleCancelRequest(request.id)}
                                            title="Hủy lời mời"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
