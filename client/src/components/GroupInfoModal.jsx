import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'
const UPLOAD_URL = 'http://localhost:5000'

export default function GroupInfoModal({ isOpen, onClose, conversation, currentUser, friends, onMembersUpdated, onLeaveGroup }) {
    const [members, setMembers] = useState([])
    const [inviteLink, setInviteLink] = useState('')
    const [showAddMembers, setShowAddMembers] = useState(false)
    const [selectedNewMembers, setSelectedNewMembers] = useState([])
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [searchPhone, setSearchPhone] = useState('')
    const [searchResult, setSearchResult] = useState(null)
    const [searchError, setSearchError] = useState('')

    const renderAvatar = (avatar, username) => {
        if (!avatar) {
            return username?.charAt(0).toUpperCase()
        }
        // Base64 image
        if (avatar.startsWith('data:image')) {
            return <img src={avatar} alt="" />
        }
        // File path (starts with / or uploads)
        if (avatar.startsWith('/') || avatar.startsWith('uploads')) {
            return <img src={`${UPLOAD_URL}${avatar.startsWith('/') ? avatar : '/' + avatar}`} alt="" />
        }
        // Otherwise (emoji or short text) - show first letter
        return username?.charAt(0).toUpperCase()
    }

    const isAdmin = members.find(m => m.id === currentUser?.id)?.role === 'admin'

    useEffect(() => {
        if (isOpen && conversation) {
            fetchGroupInfo()
            fetchInviteLink()
            setEditName(conversation.name || '')
            setIsEditing(false)
            setShowAddMembers(false)
            setSearchPhone('')
            setSearchResult(null)
            setSearchError('')
        }
    }, [isOpen, conversation])

    const fetchGroupInfo = async () => {
        try {
            const res = await axios.get(`${API_URL}/conversations/${conversation.id}/info`)
            setMembers(res.data.conversation.members || [])
        } catch (error) {
            console.error('Fetch group info error:', error)
        }
    }

    const fetchInviteLink = async () => {
        try {
            const res = await axios.get(`${API_URL}/conversations/${conversation.id}/invite-link`)
            setInviteLink(res.data.inviteLink)
        } catch (error) {
            console.error('Fetch invite link error:', error)
        }
    }

    const copyInviteLink = () => {
        navigator.clipboard.writeText(inviteLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const updateGroupName = async () => {
        if (!editName.trim()) return
        try {
            await axios.put(`${API_URL}/conversations/${conversation.id}`, { name: editName })
            setIsEditing(false)
            onMembersUpdated && onMembersUpdated()
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi cập nhật tên nhóm')
        }
    }

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            alert('Ảnh quá lớn (tối đa 5MB)')
            return
        }

        const reader = new FileReader()
        reader.onloadend = async () => {
            try {
                const response = await axios.put(`${API_URL}/conversations/${conversation.id}`, {
                    groupAvatar: reader.result
                })


                onMembersUpdated && onMembersUpdated()
            } catch (error) {
                alert(error.response?.data?.message || 'Lỗi cập nhật ảnh nhóm')
            }
        }
        reader.readAsDataURL(file)
    }

    const searchByPhone = async () => {
        if (!searchPhone.trim()) return
        setSearchError('')
        setSearchResult(null)
        try {
            const res = await axios.get(`${API_URL}/users/search?q=${searchPhone}`)
            if (res.data.users && res.data.users.length > 0) {
                const notMember = res.data.users.find(u => !members.find(m => m.id === u.id))
                if (notMember) {
                    setSearchResult(notMember)
                } else {
                    setSearchError('Người này đã trong nhóm')
                }
            } else {
                setSearchError('Không tìm thấy người dùng')
            }
        } catch (err) {
            setSearchError('Lỗi tìm kiếm')
        }
    }

    const addSearchedUser = async () => {
        if (!searchResult) return
        setLoading(true)
        try {
            await axios.post(`${API_URL}/conversations/${conversation.id}/members`, {
                userIds: [searchResult.id]
            })
            await fetchGroupInfo()
            setSearchResult(null)
            setSearchPhone('')
            onMembersUpdated && onMembersUpdated()
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi thêm thành viên')
        }
        setLoading(false)
    }

    const removeMember = async (userId) => {
        if (!confirm('Bạn có chắc muốn xóa thành viên này?')) return
        try {
            await axios.delete(`${API_URL}/conversations/${conversation.id}/members/${userId}`)
            setMembers(members.filter(m => m.id !== userId))
            onMembersUpdated && onMembersUpdated()
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi xóa thành viên')
        }
    }

    const leaveGroup = async () => {
        if (!confirm('Bạn có chắc muốn rời khỏi nhóm?')) return
        try {
            await axios.delete(`${API_URL}/conversations/${conversation.id}/members/${currentUser.id}`)
            onLeaveGroup && onLeaveGroup()
            onClose()
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi rời nhóm')
        }
    }

    const toggleNewMember = (friend) => {
        if (members.find(m => m.id === friend.id)) return
        if (selectedNewMembers.find(m => m.id === friend.id)) {
            setSelectedNewMembers(selectedNewMembers.filter(m => m.id !== friend.id))
        } else {
            setSelectedNewMembers([...selectedNewMembers, friend])
        }
    }

    const addNewMembers = async () => {
        if (selectedNewMembers.length === 0) return
        setLoading(true)
        try {
            await axios.post(`${API_URL}/conversations/${conversation.id}/members`, {
                userIds: selectedNewMembers.map(m => m.id)
            })
            await fetchGroupInfo()
            setSelectedNewMembers([])
            setShowAddMembers(false)
            onMembersUpdated && onMembersUpdated()
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi thêm thành viên')
        }
        setLoading(false)
    }

    const availableFriends = friends?.filter(f => !members.find(m => m.id === f.id)) || []

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal group-info-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Thông tin nhóm</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="group-header">
                        <div className="group-avatar-container">
                            <div className="group-avatar large">
                                {renderAvatar(conversation?.avatar, conversation?.name)}
                            </div>
                            {isAdmin && (
                                <label className="avatar-edit-overlay" title="Đổi ảnh nhóm">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                        <polyline points="21 15 16 10 5 21"></polyline>
                                    </svg>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="edit-name-row">
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="Tên nhóm"
                                    autoFocus
                                />
                                <button className="btn-save" onClick={updateGroupName}>Lưu</button>
                                <button className="btn-cancel" onClick={() => setIsEditing(false)}>Hủy</button>
                            </div>
                        ) : (
                            <div className="group-name-row">
                                <span className="group-name">{conversation?.name}</span>
                                {isAdmin && (
                                    <button className="edit-btn" onClick={() => setIsEditing(true)} title="Sửa tên">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="member-count">{members.length} thành viên</div>
                    </div>

                    <div className="invite-section">
                        <label>Link mời vào nhóm</label>
                        <div className="invite-link-row">
                            <input type="text" value={inviteLink} readOnly />
                            <button onClick={copyInviteLink} className={copied ? 'copied' : ''}>
                                {copied ? '✓ Đã copy' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    <div className="search-member-section">
                        <label>Thêm thành viên bằng SĐT hoặc tên</label>
                        <div className="search-phone-row">
                            <input
                                type="text"
                                placeholder="Nhập SĐT hoặc tên..."
                                value={searchPhone}
                                onChange={e => {
                                    setSearchPhone(e.target.value)
                                    setSearchError('')
                                }}
                                onKeyDown={e => e.key === 'Enter' && searchByPhone()}
                            />
                            <button onClick={searchByPhone}>Tìm</button>
                        </div>
                        {searchError && <div className="search-error">{searchError}</div>}
                        {searchResult && (
                            <div className="search-result">
                                <div className="user-item">
                                    <div className="avatar">
                                        {renderAvatar(searchResult.avatar, searchResult.username)}
                                    </div>
                                    <span>{searchResult.display_name || searchResult.username}</span>
                                    <button
                                        className="add-btn"
                                        onClick={addSearchedUser}
                                        disabled={loading}
                                    >
                                        {loading ? '...' : '+'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="members-section">
                        <div className="section-header">
                            <label>Thành viên ({members.length})</label>
                            {isAdmin && (
                                <button
                                    className="add-member-btn"
                                    onClick={() => setShowAddMembers(!showAddMembers)}
                                >
                                    {showAddMembers ? 'Đóng' : '+ Thêm'}
                                </button>
                            )}
                        </div>

                        {showAddMembers && (
                            <div className="add-members-panel">
                                <div className="search-member-section">
                                    <label>Tìm theo SĐT hoặc tên</label>
                                    <div className="search-phone-row">
                                        <input
                                            type="text"
                                            placeholder="Nhập SĐT hoặc tên..."
                                            value={searchPhone}
                                            onChange={e => {
                                                setSearchPhone(e.target.value)
                                                setSearchError('')
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && searchByPhone()}
                                        />
                                        <button onClick={searchByPhone}>Tìm</button>
                                    </div>
                                    {searchError && <div className="search-error">{searchError}</div>}
                                    {searchResult && (
                                        <div className="search-result">
                                            <div className="user-item">
                                                <div className="avatar">
                                                    {renderAvatar(searchResult.avatar, searchResult.username)}
                                                </div>
                                                <span>{searchResult.display_name || searchResult.username}</span>
                                                <button
                                                    className="add-btn"
                                                    onClick={addSearchedUser}
                                                    disabled={loading}
                                                >
                                                    {loading ? '...' : '+'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="from-friends-section">
                                    <label>Từ danh sách bạn bè</label>
                                    <div className="friends-list">
                                        {availableFriends.map(friend => (
                                            <div
                                                key={friend.id}
                                                className={`friend-item ${selectedNewMembers.find(m => m.id === friend.id) ? 'selected' : ''}`}
                                                onClick={() => toggleNewMember(friend)}
                                            >
                                                <div className="avatar">
                                                    {renderAvatar(friend.avatar, friend.username)}
                                                </div>
                                                <span>{friend.display_name || friend.username}</span>
                                                <div className="checkbox">
                                                    {selectedNewMembers.find(m => m.id === friend.id) && '✓'}
                                                </div>
                                            </div>
                                        ))}
                                        {availableFriends.length === 0 && (
                                            <p className="empty-text">Không có bạn bè nào để thêm</p>
                                        )}
                                    </div>
                                    {selectedNewMembers.length > 0 && (
                                        <button
                                            className="btn-primary"
                                            onClick={addNewMembers}
                                            disabled={loading}
                                        >
                                            {loading ? 'Đang thêm...' : `Thêm ${selectedNewMembers.length} người`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="members-list">
                            {members.map(member => (
                                <div key={member.id} className="member-item">
                                    <div className="avatar">
                                        {renderAvatar(member.avatar, member.username)}
                                        {member.is_online && <span className="online-indicator"></span>}
                                    </div>
                                    <div className="member-info">
                                        <span className="member-name">
                                            {member.display_name || member.username}
                                            {member.id === currentUser?.id && ' (Bạn)'}
                                        </span>
                                        {member.role === 'admin' && <span className="admin-badge">Admin</span>}
                                    </div>
                                    {isAdmin && member.id !== currentUser?.id && (
                                        <button className="remove-btn" onClick={() => removeMember(member.id)}>
                                            Xóa
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-danger" onClick={leaveGroup}>
                        Rời nhóm
                    </button>
                </div>
            </div>
        </div>
    )
}
