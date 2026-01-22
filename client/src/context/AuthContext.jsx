import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'

const AuthContext = createContext()

const API_URL = 'http://localhost:5000/api'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [loading, setLoading] = useState(true)
    const [socket, setSocket] = useState(null)

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
            fetchUser()
        } else {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (user && token && user.profile_completed) {
            const newSocket = io('http://localhost:5000', {
                auth: { token }
            })

            newSocket.on('connect', () => {
                console.log('Socket connected')
            })

            newSocket.on('connect_error', (error) => {
                console.error('Socket connection error:', error)
            })

            setSocket(newSocket)

            return () => {
                newSocket.close()
            }
        }
    }, [user, token])

    const fetchUser = async () => {
        try {
            const res = await axios.get(`${API_URL}/auth/me`)
            setUser(res.data.user)
        } catch (error) {
            console.error('Fetch user error:', error)
            logout()
        } finally {
            setLoading(false)
        }
    }

    const login = async (email, password) => {
        const res = await axios.post(`${API_URL}/auth/login`, { email, password })
        localStorage.setItem('token', res.data.token)
        setToken(res.data.token)
        setUser(res.data.user)
        return res.data
    }

    const register = async (username, email, password) => {
        const res = await axios.post(`${API_URL}/auth/register`, { username, email, password })
        return res.data
    }

    const updateUser = (updatedUser) => {
        setUser(updatedUser)
    }

    const logout = () => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
        if (socket) {
            socket.close()
            setSocket(null)
        }
    }

    return (
        <AuthContext.Provider value={{ user, token, socket, loading, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
