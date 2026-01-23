import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ProfileSetup from './pages/ProfileSetup'
import Chat from './pages/Chat'

function AppContent() {
    const { user, loading, updateUser } = useAuth()
    const [isLogin, setIsLogin] = useState(true)

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{
                        fontSize: '32px',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #0068ff, #00c6ff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        TalkingT
                    </h2>
                    <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Đang tải...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return isLogin
            ? <Login onSwitch={() => setIsLogin(false)} />
            : <Register onSwitch={() => setIsLogin(true)} />
    }

    if (!user.profile_completed) {
        return <ProfileSetup user={user} onComplete={(updatedUser) => updateUser(updatedUser)} />
    }

    return <Chat />
}

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </ThemeProvider>
    )
}

export default App
