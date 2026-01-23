import { useState, useRef, useEffect } from 'react'

export default function AnswerCallModal({
    isOpen,
    onClose,
    callData,
    socket
}) {
    const [callStatus, setCallStatus] = useState('connecting')
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [remoteStream, setRemoteStream] = useState(null)
    const [callDuration, setCallDuration] = useState(0)
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const peerConnectionRef = useRef(null)
    const localStreamRef = useRef(null)
    const iceCandidateQueue = useRef([])
    const remoteDescriptionSet = useRef(false)

    const callType = callData?.callType || 'audio'
    const caller = callData?.from
    const conversationId = callData?.conversationId
    const offer = callData?.offer
    const hasAnsweredRef = useRef(false)
    const callStartTime = useRef(null)
    const timerInterval = useRef(null)
    const hasEnded = useRef(false)
    const streamSetRef = useRef(false)

    useEffect(() => {
        if (isOpen && offer && !hasAnsweredRef.current) {
            hasAnsweredRef.current = true
            console.log('Starting answer call once...')
            answerCall()
        }
    }, [isOpen, offer])

    useEffect(() => {
        if (!isOpen) {
            hasAnsweredRef.current = false
            cleanup()
        }
    }, [isOpen])

    useEffect(() => {
        if (!socket) return

        socket.on('ice_candidate', handleIceCandidate)
        socket.on('call_ended', () => {
            console.log('Other user ended call')
            onClose()
        })

        return () => {
            socket.off('ice_candidate', handleIceCandidate)
            socket.off('call_ended')
        }
    }, [socket])

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            console.log('Setting remote stream to video element')
            remoteVideoRef.current.srcObject = remoteStream
        }
    }, [remoteStream])

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

    const answerCall = async () => {
        try {
            console.log('Answering call...', { callType, conversationId })

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
            console.log('Got local stream', stream.getTracks())

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

            peerConnectionRef.current.ontrack = (event) => {
                console.log('ontrack event:', event.track.kind, streamSetRef.current)

                if (event.streams && event.streams[0] && !streamSetRef.current) {
                    const stream = event.streams[0]
                    console.log('Setting remote stream for the first time')
                    streamSetRef.current = true

                    setRemoteStream(stream)

                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = stream
                    }

                    // Only set connected status once
                    if (!callStartTime.current) {
                        callStartTime.current = Date.now()
                        setCallStatus('connected')
                    }
                }
            }

            peerConnectionRef.current.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    console.log('Sending ICE candidate')
                    socket.emit('ice_candidate', {
                        conversationId,
                        candidate: event.candidate
                    })
                }
            }

            peerConnectionRef.current.onconnectionstatechange = () => {
                console.log('Connection state:', peerConnectionRef.current?.connectionState)
                if (peerConnectionRef.current?.connectionState === 'connected') {
                    if (!callStartTime.current) {
                        callStartTime.current = Date.now()
                    }
                    setCallStatus('connected')
                }
            }

            peerConnectionRef.current.onicegatheringstatechange = () => {
                console.log('ICE gathering state:', peerConnectionRef.current?.iceGatheringState)
            }

            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream)
            })

            await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(offer)
            )
            remoteDescriptionSet.current = true
            console.log('Set remote description')

            while (iceCandidateQueue.current.length > 0) {
                const candidate = iceCandidateQueue.current.shift()
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                console.log('Added queued ICE candidate')
            }

            const answer = await peerConnectionRef.current.createAnswer()
            await peerConnectionRef.current.setLocalDescription(answer)
            console.log('Created and set local answer')

            if (socket) {
                socket.emit('join_conversation', conversationId)
                socket.emit('accept_call', {
                    conversationId,
                    answer
                })
                console.log('Sent accept_call')
            }

            if (!callStartTime.current) {
                callStartTime.current = Date.now()
            }
            setCallStatus('connected')
        } catch (error) {
            console.error('Error answering call:', error)
            setCallStatus('error')
        }
    }

    const handleIceCandidate = async (data) => {
        try {
            console.log('Receiver got ICE candidate', data.candidate)
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

    const handleCallEnded = () => {
        cleanup()
        onClose()
    }

    const cleanup = () => {
        streamSetRef.current = false

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
            localStreamRef.current = null
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
        }
    }

    const endCall = () => {
        // IMPORTANT: Only emit once per call session!
        if (socket && !hasEnded.current) {
            hasEnded.current = true

            if (callStatus === 'connected' && callStartTime.current) {
                const duration = Math.floor((Date.now() - callStartTime.current) / 1000)
                socket.emit('call_ended', {
                    conversationId,
                    callType,
                    duration: duration,
                    callerId: caller?.id
                })
            }
        }
        cleanup()
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

    if (!isOpen) return null

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
        <div className="video-call-overlay">
            <div className={`video-call-modal ${callType}`}>
                {callType === 'video' ? (
                    <div className="video-container">
                        <video
                            ref={(el) => {
                                remoteVideoRef.current = el
                                if (el && remoteStream) {
                                    el.srcObject = remoteStream
                                }
                            }}
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
                ) : (
                    <div className="audio-call-ui">
                        <div className="caller-avatar large">
                            {renderAvatar()}
                        </div>
                        <div className="caller-name">{caller?.display_name || caller?.username}</div>
                        <div className="call-status-text">
                            {callStatus === 'connecting' && 'Đang kết nối...'}
                            {callStatus === 'connected' && (
                                <div className="call-timer" style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.2em', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                    {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                                </div>
                            )}
                            {callStatus === 'error' && 'Lỗi kết nối'}
                        </div>
                        <audio ref={remoteVideoRef} autoPlay />
                    </div>
                )}

                {/* Video Call Overlay Elements for Receiver */}
                {callType === 'video' && callStatus === 'connected' && (
                    <div className="video-call-overlay-ui" style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <div className="call-timer" style={{
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '1.5em',
                            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '4px 12px',
                            borderRadius: '20px'
                        }}>
                            {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
                        </div>
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
                        onClick={endCall}
                        title="Kết thúc cuộc gọi"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
