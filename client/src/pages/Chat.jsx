import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'
import SettingsModal from '../components/SettingsModal'
import NewChatModal from '../components/NewChatModal'
import FriendRequestsModal from '../components/FriendRequestsModal'
import VideoCallModal from '../components/VideoCallModal'
import IncomingCallModal from '../components/IncomingCallModal'
import AnswerCallModal from '../components/AnswerCallModal'
import CallingModal from '../components/CallingModal'
import CreateGroupModal from '../components/CreateGroupModal'
import GroupInfoModal from '../components/GroupInfoModal'

const API_URL = 'http://localhost:5000/api'

export default function Chat() {
    const { user, socket, logout, updateUser } = useAuth()
    const [conversations, setConversations] = useState([])
    const [activeConversation, setActiveConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [showSettings, setShowSettings] = useState(false)
    const [showNewChat, setShowNewChat] = useState(false)
    const [showFriendRequests, setShowFriendRequests] = useState(false)
    const [onlineUsers, setOnlineUsers] = useState({})
    const [typingUsers, setTypingUsers] = useState({})
    const [requestCount, setRequestCount] = useState(0)
    const [callState, setCallState] = useState({
        isActive: false,
        type: null,
        isCalling: false,
        peer: null,
        startTime: null,
        duration: 0
    })
    const [incomingCall, setIncomingCall] = useState(null)
    const [showSidebar, setShowSidebar] = useState(true)
    const [showCreateGroup, setShowCreateGroup] = useState(false)
    const [showGroupInfo, setShowGroupInfo] = useState(false)
    const [friends, setFriends] = useState([])

    useEffect(() => {
        fetchConversations()
        fetchRequestCount()
    }, [])

    useEffect(() => {
        if (!socket) return

        socket.on('new_message', (message) => {
            if (activeConversation && message.conversation_id === activeConversation.id) {
                // Thêm message vào list
                setMessages(prev => [...prev, message])

                // Nếu tin nhắn từ người khác và đang xem conversation này → mark as read
                if (message.sender_id !== user?.id) {
                    socket.emit('mark_read', { conversationId: activeConversation.id })
                }
            }
            fetchConversations()
        })

        socket.on('user_status', ({ userId, isOnline }) => {
            setOnlineUsers(prev => ({ ...prev, [userId]: isOnline }))
        })

        socket.on('user_typing', ({ conversationId, userId, username, isTyping }) => {
            if (activeConversation && conversationId === activeConversation.id) {
                setTypingUsers(prev => {
                    if (isTyping) {
                        return { ...prev, [userId]: username }
                    } else {
                        const { [userId]: _, ...rest } = prev
                        return rest
                    }
                })
            }
        })

        socket.on('incoming_call', (data) => {
            console.log('📞 Incoming call received:', data)
            setIncomingCall(data)
        })

        socket.on('call_ended', () => {
            setCallState({ isActive: false, type: null })
            setIncomingCall(null)
        })

        socket.on('messages_read', ({ conversationId }) => {
            if (activeConversation && conversationId === activeConversation.id) {
                setMessages(prev => prev.map(msg => ({ ...msg, is_read: true })))
            }
        })

        return () => {
            socket.off('new_message')
            socket.off('user_status')
            socket.off('user_typing')
            socket.off('incoming_call')
            socket.off('call_ended')
            socket.off('messages_read')
        }
    }, [socket, activeConversation])

    const fetchConversations = async () => {
        try {
            const res = await axios.get(`${API_URL}/conversations`)
            setConversations(res.data.conversations)

            // Auto-join all conversation rooms để nhận incoming calls
            if (socket) {
                res.data.conversations.forEach(conv => {
                    socket.emit('join_conversation', conv.id)
                    console.log('Auto-joined conversation room:', conv.id)
                })
            }
        } catch (error) {
            console.error('Fetch conversations error:', error)
        }
    }

    const fetchRequestCount = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/friends/requests`)
            setRequestCount(res.data.requests.length)
        } catch (error) {
            console.error('Fetch request count error:', error)
        }
    }

    const fetchFriends = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/friends/list`)
            setFriends(res.data.friends || [])
        } catch (error) {
            console.error('Fetch friends error:', error)
        }
    }

    useEffect(() => {
        fetchFriends()
    }, [])

    const selectConversation = async (conversation) => {
        setActiveConversation(conversation)
        setTypingUsers({})
        setShowSidebar(false)

        if (socket) {
            socket.emit('join_conversation', conversation.id)
            socket.emit('mark_read', { conversationId: conversation.id })
        }

        // Reset unread count trong local state
        if (conversation.unread_count > 0) {
            setConversations(prev => prev.map(conv =>
                conv.id === conversation.id
                    ? { ...conv, unread_count: 0 }
                    : conv
            ))
        }

        try {
            const res = await axios.get(`${API_URL}/conversations/${conversation.id}/messages`)
            setMessages(res.data.messages)
        } catch (error) {
            console.error('Fetch messages error:', error)
        }
    }

    const sendMessage = async (content, messageType = 'text') => {
        if (!content.trim() || !activeConversation) return

        if (socket) {
            socket.emit('send_message', {
                conversationId: activeConversation.id,
                content,
                messageType
            })
        }
    }

    const handleTyping = (isTyping) => {
        if (socket && activeConversation) {
            socket.emit('typing', {
                conversationId: activeConversation.id,
                isTyping
            })
        }
    }

    const startNewChat = async (userId) => {
        try {
            const res = await axios.post(`${API_URL}/conversations`, {
                participantIds: [userId],
                isGroup: false
            })

            await fetchConversations()

            const convRes = await axios.get(`${API_URL}/conversations/${res.data.conversation.id}`)
            selectConversation(convRes.data.conversation)
            setShowNewChat(false)
        } catch (error) {
            console.error('Start new chat error:', error)
        }
    }

    const getOtherParticipant = (conversation) => {
        if (!conversation?.participants) return null
        return conversation.participants.find(p => p.id !== user?.id)
    }

    const handleAcceptFriend = () => {
        fetchRequestCount()
    }

    const handleDeleteMessage = async (messageId) => {
        if (!activeConversation) return
        try {
            await axios.delete(`${API_URL}/conversations/${activeConversation.id}/messages/${messageId}`)
            setMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, is_deleted: true } : m
            ))
        } catch (error) {
            console.error('Delete message error:', error)
        }
    }

    const handleDeleteConversation = async (conversation) => {
        const confirmMessage = conversation.is_group
            ? `Bạn có chắc muốn rời nhóm "${conversation.name}"?`
            : `Bạn có chắc muốn xóa cuộc trò chuyện này? (Chỉ xóa cho bạn)`

        if (!window.confirm(confirmMessage)) return

        try {
            await axios.delete(`${API_URL}/conversations/${conversation.id}`)

            setConversations(prev => prev.filter(c => c.id !== conversation.id))

            if (activeConversation?.id === conversation.id) {
                setActiveConversation(null)
                setMessages([])
            }
        } catch (error) {
            console.error('Delete conversation error:', error)
            alert(error.response?.data?.message || 'Không thể xóa cuộc trò chuyện')
        }
    }

    const handleStartCall = (type) => {
        if (!activeConversation) return
        setCallState({ isActive: true, type })
    }

    const handleEndCall = () => {
        setCallState({ isActive: false, type: null })
    }

    const handleAcceptCall = async () => {
        if (!incomingCall) return

        const conv = conversations.find(c => c.id === incomingCall.conversationId)
        if (conv) {
            await selectConversation(conv)
        }

        setCallState({ isActive: false, type: incomingCall.callType, isAnswering: true })
    }

    const handleRejectCall = () => {
        if (socket && incomingCall) {
            socket.emit('reject_call', {
                conversationId: incomingCall.conversationId,
                callerId: incomingCall.from.id,
                callType: incomingCall.callType
            })
        }
        setIncomingCall(null)
    }

    return (
        <div className="app-container">
            <Sidebar
                conversations={conversations}
                activeConversation={activeConversation}
                onSelectConversation={selectConversation}
                onNewChat={() => setShowNewChat(true)}
                onSettings={() => setShowSettings(true)}
                onFriendRequests={() => setShowFriendRequests(true)}
                onCreateGroup={() => setShowCreateGroup(true)}
                currentUser={user}
                onlineUsers={onlineUsers}
                getOtherParticipant={getOtherParticipant}
                requestCount={requestCount}
                onDeleteConversation={handleDeleteConversation}
                className={showSidebar ? 'show' : 'hide'}
            />


            <ChatArea
                conversation={activeConversation}
                messages={messages}
                currentUser={user}
                onSendMessage={sendMessage}
                onTyping={handleTyping}
                typingUsers={typingUsers}
                getOtherParticipant={getOtherParticipant}
                onlineUsers={onlineUsers}
                onStartCall={handleStartCall}
                onDeleteMessage={handleDeleteMessage}
                onBackToList={() => setShowSidebar(true)}
                onGroupInfo={() => setShowGroupInfo(true)}
                className={showSidebar ? 'hide' : 'show'}
            />

            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    onLogout={logout}
                    user={user}
                    onUpdateUser={updateUser}
                />
            )}

            {showNewChat && (
                <NewChatModal
                    onClose={() => setShowNewChat(false)}
                    onStartChat={startNewChat}
                    currentUser={user}
                />
            )}

            {showFriendRequests && (
                <FriendRequestsModal
                    onClose={() => setShowFriendRequests(false)}
                    onAccept={handleAcceptFriend}
                />
            )}

            {callState.isActive && activeConversation && (
                <VideoCallModal
                    isOpen={callState.isActive}
                    onClose={handleEndCall}
                    callType={callState.type}
                    otherUser={getOtherParticipant(activeConversation)}
                    socket={socket}
                    conversationId={activeConversation.id}
                    currentUser={user}
                />
            )}

            {incomingCall && !callState.isAnswering && (
                <IncomingCallModal
                    caller={incomingCall.from}
                    callType={incomingCall.callType}
                    onAccept={handleAcceptCall}
                    onReject={handleRejectCall}
                />
            )}

            {callState.isAnswering && incomingCall && (
                <AnswerCallModal
                    isOpen={callState.isAnswering}
                    onClose={() => {
                        setCallState({ isActive: false, type: null, isAnswering: false })
                        setIncomingCall(null)
                    }}
                    callData={incomingCall}
                    socket={socket}
                />
            )}

            <CreateGroupModal
                isOpen={showCreateGroup}
                onClose={() => setShowCreateGroup(false)}
                friends={friends}
                onGroupCreated={(conv) => {
                    fetchConversations()
                    setActiveConversation(conv)
                }}
            />

            <GroupInfoModal
                isOpen={showGroupInfo}
                onClose={() => setShowGroupInfo(false)}
                conversation={activeConversation}
                currentUser={user}
                friends={friends}
                onMembersUpdated={fetchConversations}
                onLeaveGroup={() => {
                    setActiveConversation(null)
                    fetchConversations()
                }}
            />
        </div>
    )
}
