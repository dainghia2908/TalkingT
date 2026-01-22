import { useState, useRef, useEffect } from 'react'

export default function VideoCallModal({
    isOpen,
    onClose,
    callType,
    otherUser,
    socket,
    conversationId,
    currentUser
}) {
    const [callStatus, setCallStatus] = useState('calling')
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [callDuration, setCallDuration] = useState(0)
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const peerConnectionRef = useRef(null)
    const localStreamRef = useRef(null)
    const iceCandidateQueue = useRef([])
    const remoteDescriptionSet = useRef(false)
    const callTimeoutRef = useRef(null)
    const callStartTime = useRef(null)
    const timerInterval = useRef(null)
    const hasStarted = useRef(false)
    const hasEnded = useRef(false)

    useEffect(() => {
        if (isOpen && !hasStarted.current) {
            hasStarted.current = true
            hasEnded.current = false
            startCall()
        }

        return () => {
            // Only cleanup on actual unmount, not re-renders
            if (!isOpen) {
                hasStarted.current = false
                if (timerInterval.current) {
                    clearInterval(timerInterval.current)
                }
            }
        }
    }, [isOpen])

    useEffect(() => {
        if (callStatus === 'connected') {
            timerInterval.current = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000))
            }, 1000)
        }

        return () => {
            if (timerInterval.current) {
                clearInterval(timerInterval.current)
            }
        }
    }, [callStatus])

    useEffect(() => {
        if (!socket) return

        socket.on('call_accepted', handleCallAccepted)
        socket.on('call_rejected', handleCallRejected)
        socket.on('ice_candidate', handleIceCandidate)
        socket.on('call_answer', handleCallAnswer)
        socket.on('call_ended', () => {
            console.log('Other user ended call')
            onClose()
        })

        return () => {
            socket.off('call_accepted')
            socket.off('call_rejected')
            socket.off('ice_candidate')
            socket.off('call_answer')
            socket.off('call_ended')
        }
    }, [socket])

    // Timeout 30s nếu không trả lời
    useEffect(() => {
        if (isOpen && callStatus === 'calling') {
            callTimeoutRef.current = setTimeout(() => {
                console.log('Call timeout - no answer after 30s')
                handleCallTimeout()
            }, 30000) // 30 seconds
        }

        return () => {
            if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current)
            }
        }
    }, [isOpen, callStatus])

    const startCall = async () => {
        try {
            const constraints = {
                audio: true,
                video: callType === 'video' ? {
                    width: { ideal: 160, max: 320 },
                    height: { ideal: 120, max: 240 },
                    frameRate: { ideal: 12, max: 15 }
                } : false
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            localStreamRef.current = stream

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
            }

            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    {
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ]
            }

            peerConnectionRef.current = new RTCPeerConnection(configuration)

            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream)
            })

            peerConnectionRef.current.ontrack = (event) => {
                console.log('Caller received remote track', event.streams)
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0]
                }
                callStartTime.current = Date.now()
                setCallStatus('connected')
            }

            peerConnectionRef.current.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    console.log('Caller sending ICE candidate')
                    socket.emit('ice_candidate', {
                        conversationId,
                        candidate: event.candidate
                    })
                }
            }

            peerConnectionRef.current.onconnectionstatechange = () => {
                console.log('Caller connection state:', peerConnectionRef.current?.connectionState)
                if (peerConnectionRef.current?.connectionState === 'connected') {
                    if (!callStartTime.current) {
                        callStartTime.current = Date.now()
                    }
                    setCallStatus('connected')
                }
            }

            peerConnectionRef.current.onicegatheringstatechange = () => {
                console.log('Caller ICE gathering state:', peerConnectionRef.current?.iceGatheringState)
            }

            const offer = await peerConnectionRef.current.createOffer()
            await peerConnectionRef.current.setLocalDescription(offer)
            console.log('Caller created offer')

            if (socket) {
                socket.emit('join_conversation', conversationId)
                socket.emit('call_user', {
                    conversationId,
                    callType,
                    offer
                })
                console.log('Caller sent call_user')
            }

            setCallStatus('calling')
        } catch (error) {
            console.error('Error starting call:', error)

            // Handle permission denied
            if (error.name === 'NotAllowedError') {
                alert('Vui lòng cho phép quyền truy cập camera/microphone để thực hiện cuộc gọi.\n\nClick vào biểu tượng khóa/camera bên trái URL và chọn "Cho phép".')
            } else if (error.name === 'NotFoundError') {
                alert('Không tìm thấy camera/microphone. Vui lòng kiểm tra thiết bị.')
            }

            // Close modal on error
            onClose()
            setCallStatus('error')
        }
    }

    const handleCallAccepted = async (data) => {
        try {
            console.log('Caller received call_accepted', data)
            // Clear timeout khi call được accept
            if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current)
            }

            if (peerConnectionRef.current && data.answer) {
                await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                )
                remoteDescriptionSet.current = true
                console.log('Caller set remote description from answer')

                while (iceCandidateQueue.current.length > 0) {
                    const candidate = iceCandidateQueue.current.shift()
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                    console.log('Added queued ICE candidate')
                }

                setCallStatus('connected')
            }
        } catch (error) {
            console.error('Error handling call accepted:', error)
        }
    }

    const handleCallAnswer = async (data) => {
        try {
            if (peerConnectionRef.current && data.answer) {
                await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                )
                remoteDescriptionSet.current = true
            }
        } catch (error) {
            console.error('Error handling answer:', error)
        }
    }

    const handleIceCandidate = async (data) => {
        try {
            console.log('Caller received ICE candidate', data.candidate)
            if (peerConnectionRef.current && data.candidate) {
                if (remoteDescriptionSet.current) {
                    await peerConnectionRef.current.addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    )
                    console.log('Added ICE candidate immediately')
                } else {
                    iceCandidateQueue.current.push(data.candidate)
                    console.log('Queued ICE candidate')
                }
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error)
        }
    }

    const handleCallRejected = () => {
        setCallStatus('rejected')
        setTimeout(() => onClose(), 2000)
    }

    const handleCallEnded = () => {
        endCall()
        onClose()
    }

    const handleCallTimeout = () => {
        if (socket) {
            socket.emit('call_timeout', {
                conversationId,
                callType
            })
        }
        setCallStatus('timeout')
        setTimeout(() => onClose(), 2000)
    }

    const endCall = () => {
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current)
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
            localStreamRef.current = null
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
        }

        // IMPORTANT: Only emit once per call session!
        if (socket && !hasEnded.current) {
            hasEnded.current = true

            if (callStatus === 'calling') {
                socket.emit('call_cancelled', {
                    conversationId,
                    callType
                })
            } else if (callStatus === 'connected' && callStartTime.current) {
                const duration = Math.floor((Date.now() - callStartTime.current) / 1000)
                socket.emit('call_ended', {
                    conversationId,
                    callType,
                    duration: duration,
                    callerId: currentUser?.id
                })
            }
        }

        onClose()
    }

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsMuted(!audioTrack.enabled)
            }
        }
    }

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsVideoOff(!videoTrack.enabled)
            }
        }
    }

    const handleEndCall = () => {
        endCall()
        onClose()
    }

    if (!isOpen) return null

    const renderAvatar = () => {
        if (otherUser?.avatar && otherUser.avatar.startsWith('data:')) {
            return <img src={otherUser.avatar} alt="" />
        }
        if (otherUser?.avatar && otherUser.avatar.length <= 4) {
            return otherUser.avatar
        }
        return (otherUser?.display_name || otherUser?.username)?.charAt(0).toUpperCase() || '?'
    }

    return (
        <div className="video-call-overlay">
            <div className={`video-call-modal ${callType}`}>
                {callType === 'video' ? (
                    <>
                        <div className="video-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {callStatus !== 'connected' && (
                                <div className="calling-overlay">
                                    <div className="calling-avatar large">
                                        {renderAvatar()}
                                    </div>
                                    <div className="calling-info">
                                        <h3 style={{ color: 'white' }}>{otherUser?.display_name || otherUser?.username}</h3>
                                        <p className="calling-status">Đang gọi...</p>
                                    </div>
                                </div>
                            )}

                            <video
                                ref={remoteVideoRef}
                                className="remote-video"
                                autoPlay
                                playsInline
                            />
                            <video
                                ref={localVideoRef}
                                className="local-video"
                                autoPlay
                                playsInline
                                muted
                            />
                        </div>

                        {/* Timer - Fixed position at bottom */}
                        {callStatus === 'connected' && (
                            <div style={{
                                position: 'fixed',
                                bottom: '100px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 9999,
                                pointerEvents: 'none'
                            }}>
                                <div style={{
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    fontSize: '1.5em',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                    background: 'rgba(0,0,0,0.5)',
                                    padding: '6px 16px',
                                    borderRadius: '20px'
                                }}>
                                    {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="audio-call-ui">
                        <div className="caller-avatar large">
                            {renderAvatar()}
                        </div>
                        <div className="caller-name">{otherUser?.display_name || otherUser?.username}</div>
                        <div className="call-status-text">
                            {callStatus === 'calling' && 'Đang gọi...'}
                            {callStatus === 'connected' && (
                                <div className="call-timer" style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.2em', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                    {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                                </div>
                            )}
                            {callStatus === 'timeout' && 'Không trả lời'}
                            {callStatus === 'rejected' && 'Đã từ chối'}
                            {callStatus === 'error' && 'Lỗi kết nối'}
                        </div>
                        <audio ref={remoteVideoRef} autoPlay />
                        <audio ref={localVideoRef} autoPlay muted style={{ display: 'none' }} />
                    </div>
                )}

                <div className="call-controls">
                    <button
                        className={`call-btn ${isMuted ? 'active' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Bật mic' : 'Tắt mic'}
                    >
                        {isMuted ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        )}
                    </button>

                    {callType === 'video' && (
                        <button
                            className={`call-btn ${isVideoOff ? 'active' : ''}`}
                            onClick={toggleVideo}
                            title={isVideoOff ? 'Bật camera' : 'Tắt camera'}
                        >
                            {isVideoOff ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                </svg>
                            )}
                        </button>
                    )}

                    <button
                        className="call-btn end-call"
                        onClick={handleEndCall}
                        title="Kết thúc cuộc gọi"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div >
    )
}
