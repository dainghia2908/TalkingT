import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

export default function FriendRequestsModal({ onClose, onAccept }) {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRequests()
    }, [])

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/friends/requests`)
            setRequests(res.data.requests)
        } catch (error) {
            console.error('Fetch requests error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAccept = async (userId) => {
        try {
            await axios.put(`${API_URL}/users/friend-request/${userId}/accept`)
            setRequests(prev => prev.filter(r => r.id !== userId))
            if (onAccept) onAccept()
        } catch (error) {
            console.error('Accept error:', error)
        }
    }

    const handleReject = async (userId) => {
        try {
            await axios.delete(`${API_URL}/users/friend-request/${userId}`)
            setRequests(prev => prev.filter(r => r.id !== userId))
        } catch (error) {
            console.error('Reject error:', error)
        }
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

    const formatTime = (dateString) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now - date

        if (diff < 60000) return 'Vừa xong'
        if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`
        return `${Math.floor(diff / 86400000)} ngày trước`
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <h3>Lời mời kết bạn</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-state">Đang tải...</div>
                    ) : requests.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>Không có lời mời kết bạn</p>
                        </div>
                    ) : (
                        <div className="requests-list">
                            {requests.map(request => (
                                <div key={request.id} className="request-item">
                                    <div className="request-avatar">
                                        {renderAvatar(request)}
                                    </div>
                                    <div className="request-info">
                                        <div className="request-name">{request.display_name || request.username}</div>
                                        <div className="request-time">{formatTime(request.created_at)}</div>
                                    </div>
                                    <div className="request-actions">
                                        <button
                                            className="btn-accept"
                                            onClick={() => handleAccept(request.id)}
                                            title="Chấp nhận"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            className="btn-reject"
                                            onClick={() => handleReject(request.id)}
                                            title="Từ chối"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
