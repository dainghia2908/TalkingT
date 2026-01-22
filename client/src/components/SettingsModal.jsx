import { useState, useRef } from 'react'
import axios from 'axios'
import { useTheme } from '../context/ThemeContext'

const API_URL = 'http://localhost:5000/api'

const defaultAvatars = [
    '👤', '😊', '😎', '🤖', '👨', '👩', '🧑', '👶', '🐱', '🐶', '🦊', '🐼'
]

export default function SettingsModal({ onClose, onLogout, user, onUpdateUser }) {
    const { theme, setTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('account')
    const [displayName, setDisplayName] = useState(user?.display_name || '')
    const [bio, setBio] = useState(user?.bio || '')
    const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '👤')
    const [customAvatar, setCustomAvatar] = useState(
        user?.avatar?.startsWith('data:') ? user.avatar : null
    )
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')
    const fileInputRef = useRef(null)

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError('Ảnh phải nhỏ hơn 2MB')
                return
            }

            const reader = new FileReader()
            reader.onloadend = () => {
                setCustomAvatar(reader.result)
                setSelectedAvatar(null)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveProfile = async () => {
        if (!displayName.trim()) {
            setError('Vui lòng nhập tên hiển thị')
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const avatarToSend = customAvatar || selectedAvatar
            const res = await axios.put(`${API_URL}/users/profile`, {
                displayName,
                bio,
                avatar: avatarToSend
            })
            setSuccess('Đã lưu thay đổi!')
            if (onUpdateUser) onUpdateUser(res.data.user)
            setTimeout(() => setSuccess(''), 2000)
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra')
        } finally {
            setLoading(false)
        }
    }

    const renderAvatar = () => {
        if (customAvatar) {
            return <img src={customAvatar} alt="Avatar" />
        }
        return <span>{selectedAvatar}</span>
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Cài đặt</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
                        onClick={() => setActiveTab('account')}
                    >
                        👤 Tài khoản
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >
                        🎨 Giao diện
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'account' && (
                        <div className="settings-account">
                            {error && <div className="error-message">{error}</div>}
                            {success && <div className="success-message">{success}</div>}

                            <div className="profile-avatar-section">
                                <div className="profile-avatar-preview">
                                    {renderAvatar()}
                                </div>
                                <button
                                    className="btn-change-avatar"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    📷 Đổi ảnh
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div className="avatar-options">
                                {defaultAvatars.map((avatar, index) => (
                                    <button
                                        key={index}
                                        className={`avatar-option-small ${selectedAvatar === avatar && !customAvatar ? 'active' : ''}`}
                                        onClick={() => {
                                            setSelectedAvatar(avatar)
                                            setCustomAvatar(null)
                                        }}
                                    >
                                        {avatar}
                                    </button>
                                ))}
                            </div>

                            <div className="form-group">
                                <label>Tên hiển thị</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Nhập tên hiển thị"
                                />
                            </div>

                            <div className="form-group">
                                <label>Mô tả cá nhân</label>
                                <textarea
                                    className="bio-input"
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Viết vài dòng về bản thân..."
                                    rows={3}
                                    maxLength={200}
                                />
                                <small className="char-count">{bio.length}/200</small>
                            </div>

                            <button
                                className="btn btn-primary"
                                onClick={handleSaveProfile}
                                disabled={loading}
                                style={{ marginBottom: '16px' }}
                            >
                                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>

                            <hr className="divider" />

                            <button className="btn-logout" onClick={onLogout}>
                                🚪 Đăng xuất
                            </button>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="settings-appearance">
                            <div className="settings-section">
                                <h4>Chế độ hiển thị</h4>
                                <div className="theme-toggle">
                                    <button
                                        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                        onClick={() => setTheme('light')}
                                    >
                                        <span>☀️</span>
                                        <p>Sáng</p>
                                    </button>
                                    <button
                                        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                        onClick={() => setTheme('dark')}
                                    >
                                        <span>🌙</span>
                                        <p>Tối</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
