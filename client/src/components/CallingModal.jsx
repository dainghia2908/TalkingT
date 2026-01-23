import { useEffect, useState } from 'react'

const API_URL = 'http://localhost:5000/api'
const UPLOAD_URL = 'http://localhost:5000'

export default function CallingModal({ peer, callType, onCancel }) {
    const [dots, setDots] = useState('.')

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '.' : prev + '.')
        }, 500)
        return () => clearInterval(interval)
    }, [])

    const renderAvatar = () => {
        if (peer?.avatar) {
            if (peer.avatar.startsWith('data:image')) {
                return <img src={peer.avatar} alt="" />
            }
            if (peer.avatar.startsWith('/') || peer.avatar.startsWith('uploads')) {
                return <img src={`${UPLOAD_URL}${peer.avatar.startsWith('/') ? peer.avatar : '/' + peer.avatar}`} alt="" />
            }
        }
        return peer?.username?.charAt(0).toUpperCase() || 'U'
    }

    return (
        <div className="call-modal-overlay">
            <div className="call-modal calling">
                <div className="call-avatar large">
                    {renderAvatar()}
                </div>

                <h2 className="call-name">{peer?.display_name || peer?.username}</h2>

                <p className="call-status">
                    {callType === 'video' ? 'Đang gọi video' : 'Đang gọi'}{dots}
                </p>

                <div className="call-actions">
                    <button className="call-btn call-btn-end" onClick={onCancel}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 1L1 23M1 1l22 22" />
                        </svg>
                        <span>Hủy</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
