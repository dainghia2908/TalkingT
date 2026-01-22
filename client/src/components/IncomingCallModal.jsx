export default function IncomingCallModal({ caller, callType, onAccept, onReject }) {
    const renderAvatar = () => {
        if (caller?.avatar && caller.avatar.startsWith('data:')) {
            return <img src={caller.avatar} alt="" />
        }
        if (caller?.avatar && caller.avatar.length <= 4) {
            return caller.avatar
        }
        return (caller?.display_name || caller?.username)?.charAt(0).toUpperCase() || '?'
    }

    return (
        <div className="incoming-call-overlay">
            <div className="incoming-call-modal">
                <div className="caller-info">
                    <div className="caller-avatar pulse">
                        {renderAvatar()}
                    </div>
                    <div className="caller-name">{caller?.display_name || caller?.username}</div>
                    <div className="call-type-text">
                        {callType === 'video' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
                    </div>
                </div>

                <div className="incoming-call-actions">
                    <button className="call-action-btn reject" onClick={onReject}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                    <button className="call-action-btn accept" onClick={onAccept}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
