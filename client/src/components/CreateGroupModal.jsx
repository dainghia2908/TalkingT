import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'
const UPLOAD_URL = 'http://localhost:5000'

export default function CreateGroupModal({ isOpen, onClose, friends, onGroupCreated }) {
    const [groupName, setGroupName] = useState('')
    const [selectedMembers, setSelectedMembers] = useState([])
    const [searchPhone, setSearchPhone] = useState('')
    const [searchResult, setSearchResult] = useState(null)
    const [searching, setSearching] = useState(false)
    const [error, setError] = useState('')
    const [searchError, setSearchError] = useState('')
    const [loading, setLoading] = useState(false)

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

    useEffect(() => {
        if (!isOpen) {
            setGroupName('')
            setSelectedMembers([])
            setSearchPhone('')
            setSearchResult(null)
            setError('')
            setSearchError('')
        }
    }, [isOpen])

    const toggleMember = (friend) => {
        if (selectedMembers.find(m => m.id === friend.id)) {
            setSelectedMembers(selectedMembers.filter(m => m.id !== friend.id))
        } else {
            if (selectedMembers.length >= 49) {
                setError('Nhóm tối đa 50 thành viên (bao gồm bạn)')
                return
            }
            setSelectedMembers([...selectedMembers, friend])
        }
    }

    const searchByPhone = async () => {
        if (!searchPhone.trim()) return

        setSearching(true)
        setSearchResult(null)
        try {
            const res = await axios.get(`${API_URL}/users/search?q=${searchPhone}`)
            if (res.data.users && res.data.users.length > 0) {
                setSearchResult(res.data.users[0])
            } else {
                setSearchError('Không tìm thấy người dùng')
            }
        } catch (err) {
            setSearchError('Lỗi tìm kiếm')
        }
        setSearching(false)
    }

    const addSearchResult = () => {
        if (!searchResult) return
        if (selectedMembers.find(m => m.id === searchResult.id)) {
            setError('Người này đã được thêm')
            return
        }
        if (friends.find(f => f.id === searchResult.id)) {
            setError('Người này đã có trong danh sách bạn bè')
            return
        }
        setSelectedMembers([...selectedMembers, searchResult])
        setSearchResult(null)
        setSearchPhone('')
    }

    const createGroup = async () => {
        if (!groupName.trim()) {
            setError('Vui lòng nhập tên nhóm')
            return
        }
        if (selectedMembers.length < 2) {
            setError('Chọn ít nhất 2 người (nhóm cần tối thiểu 3 thành viên)')
            return
        }

        setLoading(true)
        setError('')
        try {
            const res = await axios.post(`${API_URL}/conversations/group`, {
                name: groupName,
                memberIds: selectedMembers.map(m => m.id)
            })
            onGroupCreated(res.data.conversation)
            onClose()
        } catch (error) {
            setError(error.response?.data?.message || 'Lỗi tạo nhóm')
        }
        setLoading(false)
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal create-group-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Tạo nhóm mới</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Tên nhóm</label>
                        <input
                            type="text"
                            placeholder="Nhập tên nhóm..."
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>Tìm theo số điện thoại hoặc tên</label>
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
                            <button onClick={searchByPhone} disabled={searching}>
                                {searching ? '...' : 'Tìm'}
                            </button>
                        </div>
                        {searchError && <div className="search-error">{searchError}</div>}
                        {searchResult && (
                            <div className="search-result">
                                <div className="user-item">
                                    <div className="avatar">
                                        {renderAvatar(searchResult.avatar, searchResult.username)}
                                    </div>
                                    <span>{searchResult.display_name || searchResult.username}</span>
                                    <button className="add-btn" onClick={addSearchResult}>+</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Chọn từ danh sách bạn bè ({selectedMembers.length}/49)</label>
                        <div className="friends-list">
                            {friends && friends.map(friend => (
                                <div
                                    key={friend.id}
                                    className={`friend-item ${selectedMembers.find(m => m.id === friend.id) ? 'selected' : ''}`}
                                    onClick={() => toggleMember(friend)}
                                >
                                    <div className="avatar">
                                        {renderAvatar(friend.avatar, friend.username)}
                                    </div>
                                    <span>{friend.display_name || friend.username}</span>
                                    <div className="checkbox">
                                        {selectedMembers.find(m => m.id === friend.id) && '✓'}
                                    </div>
                                </div>
                            ))}
                            {(!friends || friends.length === 0) && (
                                <p className="empty-text">Chưa có bạn bè nào</p>
                            )}
                        </div>
                    </div>

                    {selectedMembers.length > 0 && (
                        <div className="selected-members">
                            <label>Đã chọn ({selectedMembers.length})</label>
                            <div className="members-chips">
                                {selectedMembers.map(member => (
                                    <span key={member.id} className="chip">
                                        {member.display_name || member.username}
                                        <button onClick={() => toggleMember(member)}>×</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Hủy</button>
                    <button
                        className="btn-primary"
                        onClick={createGroup}
                        disabled={loading || selectedMembers.length < 2 || !groupName.trim()}
                    >
                        {loading ? 'Đang tạo...' : 'Tạo nhóm'}
                    </button>
                </div>
            </div>
        </div>
    )
}
