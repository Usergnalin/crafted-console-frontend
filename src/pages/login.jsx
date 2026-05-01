import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../api/client.jsx'
import { Eye, EyeOff } from 'lucide-react'

// Google G Logo SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function Login() {
  const [username, set_username] = useState('')
  const [password, set_password] = useState('')
  const [username_wrong, set_username_wrong] = useState(false)
  const [password_wrong, set_password_wrong] = useState(false)
  const [login_error, set_login_error] = useState('')
  const [password_hidden, set_password_hidden] = useState(true)
  const [google_loading, set_google_loading] = useState(false)
  const navigate = useNavigate()
  const {client} = useApi()

  async function handle_login_submit(event) {
    event.preventDefault()
    const response = await client.post('/auth/login', {username, password})
    if (response.status === 204) {
      navigate('/dashboard')
    } else {
      const message = response.data.message
      set_username_wrong(false)
      set_password_wrong(false)
      if (message === "User not found" || message === "Invalid username") set_username_wrong(true)
      else if (message === "Password incorrect" || message === "Invalid password") set_password_wrong(true)
      set_login_error(message)
    }
  }

  async function handle_google_login() {
    set_google_loading(true)
    set_login_error('')
    try {
      const response = await client.get('/auth/google/init')
      // Response body is a plain string URL
      window.location.href = response.data
    } catch (error) {
      console.error('Google login error:', error)
      set_login_error('Failed to initiate Google login. Please try again.')
    } finally {
      set_google_loading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary p-4">
      <div className="w-full max-w-sm bg-bg-card border border-border-primary p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-text-primary mb-6 text-center">Welcome Back</h1>

        <form onSubmit={handle_login_submit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label className="text-sm text-text-muted ml-1">Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={element => {set_username(element.target.value); set_username_wrong(false)}}
              className={`w-full p-3 bg-bg-input text-text-primary placeholder-text-muted border rounded-lg outline-none transition-all ${
                username_wrong ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border-primary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary'
              }`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-muted ml-1">Password</label>
            <div className="relative">
              <input
                type={password_hidden ? 'password' : 'text'}
                placeholder="Enter your password"
                value={password}
                onChange={element => {set_password(element.target.value); set_password_wrong(false)}}
                className={`w-full p-3 bg-bg-input text-text-primary placeholder-text-muted border rounded-lg outline-none transition-all pr-10 ${
                  password_wrong ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-border-primary focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary'
                }`}
              />
              <button
                type="button"
                onClick={() => set_password_hidden(!password_hidden)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {password_hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {login_error && (
            <p className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg py-2 px-3">
              {login_error}
            </p>
          )}
          
          <button
            type="submit"
            className="w-full bg-accent-primary hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition duration-200 mt-2"
          >
            Log in
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border-primary"></div>
          <span className="text-xs text-text-muted uppercase tracking-wider">Or continue with</span>
          <div className="flex-1 h-px bg-border-primary"></div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handle_google_login}
          disabled={google_loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-700 font-medium py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {google_loading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <GoogleIcon />
          )}
          {google_loading ? 'Connecting...' : 'Login with Google'}
        </button>
      </div>
    </div>
  )
}