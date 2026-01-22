import { useState, useRef } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

const defaultAvatars = [
    '👤', '😊', '😎', '🤖', '👨', '👩', '🧑', '👶', '🐱', '🐶', '🦊', '🐼'
]

export default function ProfileSetup({ user, onComplete }) {
    const [displayName, setDisplayName] = useState(user?.username || '')
    const [phone, setPhone] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState('👤')
    const [customAvatar, setCustomAvatar] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
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

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!displayName.trim()) {
            setError('Vui lòng nhập tên hiển thị')
            return
        }

        if (!phone.trim()) {
            setError('Vui lòng nhập số điện thoại')
            return
        }

        if (!phone.startsWith('0')) {
            setError('Số điện thoại phải bắt đầu bằng số 0')
            return
        }

        const phoneRegex = /^0[0-9]{9,10}$/
        if (!phoneRegex.test(phone)) {
            setError('Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)')
            return
        }

        setLoading(true)

        try {
            const avatarToSend = customAvatar || selectedAvatar
            const res = await axios.put(`${API_URL}/users/profile`, {
                displayName,
                phone,
                avatar: avatarToSend
            })
            onComplete(res.data.user)
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: '500px' }}>
                <div className="auth-logo">
                    <h1>Hoàn thành hồ sơ</h1>
                    <p>Thiết lập thông tin cá nhân của bạn</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Ảnh đại diện</label>

                        <div className="avatar-preview-container">
                            <div className="avatar-preview">
                                {customAvatar ? (
                                    <img src={customAvatar} alt="Avatar" />
                                ) : (
                                    <span>{selectedAvatar}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                className="btn-upload"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                📷 Tải ảnh từ máy
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '12px 0 8px' }}>
                            Hoặc chọn avatar mặc định:
                        </p>
                        <div className="avatar-grid">
                            {defaultAvatars.map((avatar, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    className={`avatar-option ${selectedAvatar === avatar && !customAvatar ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedAvatar(avatar)
                                        setCustomAvatar(null)
                                    }}
                                >
                                    {avatar}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Tên hiển thị</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Nhập tên hiển thị của bạn"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Số điện thoại</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="VD: 0912345678"
                            required
                            maxLength={11}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            🔍 Bạn bè sẽ dùng số điện thoại này để tìm bạn
                        </small>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Đang lưu...' : 'Hoàn thành'}
                    </button>
                </form>
            </div>
        </div>
    )
}
