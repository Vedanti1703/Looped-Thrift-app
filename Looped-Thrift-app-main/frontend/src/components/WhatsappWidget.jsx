import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Spinner from './Spinner'

const QUICK_PROMPTS = [
  { label: '🛍️ Order an Item', text: 'I want to place an order' },
  { label: '📦 Return Policy', text: 'What is your return policy?' },
  { label: '💰 Get Discount', text: 'Can I get a discount?' },
  { label: '🚚 Delivery Details', text: 'How long does delivery take?' },
  { label: '🧥 Recommend Hoodie', text: 'Recommend a black hoodie' },
  { label: '☎️ Human Support', text: 'I need to speak to support' }
]

export default function WhatsappWidget() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isOpen, setIsOpen] = useState(false)
  const [showBadge, setShowBadge] = useState(false)
  const [convo, setConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  
  const pollRef = useRef(null)
  const listRef = useRef(null)

  // Show pulsing notification badge after 5 seconds to grab attention
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) setShowBadge(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Scroll to bottom helper
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isTyping, isOpen])

  // Setup/load chat when widget opens
  useEffect(() => {
    if (isOpen && token) {
      loadAssistantConvo()
      pollRef.current = setInterval(() => {
        if (convo) {
          fetchMessages(convo._id, true)
        }
      }, 3000)
    } else {
      clearInterval(pollRef.current)
    }

    return () => clearInterval(pollRef.current)
  }, [isOpen, convo?._id, token])

  const loadAssistantConvo = async () => {
    setLoading(true)
    try {
      // Find or create Looped AI general convo
      const res = await api.post('/chat/conversation', {
        sellerName: 'Looped AI'
      })
      setConvo(res.data)
      await fetchMessages(res.data._id)
    } catch (err) {
      console.error('Failed to load Looped AI convo:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (convoId, silent = false) => {
    try {
      const res = await api.get(`/chat/messages/${convoId}`)
      // If we got new messages, play a subtle incoming sound/simulate typing
      setMessages(res.data.messages)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSend = async (overrideText) => {
    const textToSend = (overrideText || input).trim()
    if (!textToSend || !convo) return
    
    setInput('')
    setSending(true)
    setIsTyping(true) // simulate Looped AI thinking

    // Optimistic UI update
    const optimisticMessage = {
      _id: 'temp_' + Date.now(),
      senderId: user._id || user.id,
      senderName: user.name || 'You',
      text: textToSend,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimisticMessage])

    try {
      await api.post('/chat/messages', {
        conversationId: convo._id,
        text: textToSend
      })
      // Instantly load response
      await fetchMessages(convo._id)
    } catch (err) {
      console.error(err)
      // Rollback on fail
      setMessages(prev => prev.filter(m => m._id !== optimisticMessage._id))
    } finally {
      setSending(false)
      // Brief extra delay for natural typing feel
      setTimeout(() => {
        setIsTyping(false)
      }, 800)
    }
  }

  const toggleWidget = () => {
    setIsOpen(!isOpen)
    setShowBadge(false)
  }

  // Hide WhatsApp Widget on full screen chat page to avoid redundancy
  if (location.pathname === '/chat') return null

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-[calc(100vw-32px)]">
      
      {/* Floating Action Button */}
      <button
        onClick={toggleWidget}
        className={`w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white flex items-center justify-center shadow-lg active:scale-95 transition-all relative ${
          !isOpen && showBadge ? 'animate-bounce' : ''
        }`}
        title="Chat with Looped AI"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.503-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.638 1.977 14.178.953 11.975.953 6.541.953 2.117 5.324 2.113 10.75c-.001 1.693.456 3.348 1.32 4.809l-.995 3.637 3.73-.978L6.647 19.15z" />
          </svg>
        )}
        
        {/* Pulsing Notification Badge */}
        {!isOpen && showBadge && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[9px] font-bold items-center justify-center">1</span>
          </span>
        )}
      </button>

      {/* WhatsApp Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 h-[460px] bg-white rounded-3xl border border-emerald-100 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          
          {/* Header */}
          <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              {/* Profile Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-800 border-2 border-white shadow-sm">
                  🤖
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></span>
              </div>
              
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="font-bold text-sm tracking-wide">Looped AI</h3>
                  {/* Verified Checkmark Badge */}
                  <span className="w-3.5 h-3.5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold" title="Verified Assistant">✓</span>
                </div>
                <p className="text-[10px] text-emerald-100">Typically replies instantly</p>
              </div>
            </div>

            {/* Header Call Buttons (Mocked) */}
            <div className="flex items-center gap-2 text-emerald-100">
              <button onClick={() => alert("Looped AI is a message-only assistant.")} className="p-1 hover:text-white transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <button onClick={toggleWidget} className="p-1 hover:text-white transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Body Container with Doodle Background */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 relative"
            style={{
              backgroundColor: '#efeae2',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23d1c3b1' fill-opacity='0.15'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zM11 13c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm48 25c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM32 60c5.523 0 10-4.477 10-10S37.523 40 32 40s-10 4.477-10 10 4.477 10 10 10zm0-5c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z'/%3E%3C/g%3E%3C/svg%3E")`
            }}
          >
            {!token ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-white/80 backdrop-blur rounded-2xl border border-pink-100">
                <span className="text-4xl mb-3">💬</span>
                <p className="font-semibold text-gray-700 text-sm">Sign in to chat with Looped AI</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Looped AI helps you order, recommend hoodies, and answer delivery questions.</p>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/login')
                  }}
                  className="btn-primary py-2 text-xs"
                >
                  Sign In
                </button>
              </div>
            ) : loading ? (
              <div className="h-full flex items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="text-center py-4 text-xs text-gray-400 font-medium italic">
                    Looped AI is ready. Type something below 👋
                  </div>
                )}
                
                {messages.map((msg) => {
                  const isMe = msg.senderId === user._id || msg.senderId === user.id
                  return (
                    <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs relative shadow-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#d9fdd3] text-[#1a1a1a] rounded-tr-none'
                            : 'bg-white text-[#1a1a1a] rounded-tl-none border border-gray-100'
                        }`}
                      >
                        {/* Text formatting: Bold tags like *LOOPED10* or *Product* */}
                        <p className="whitespace-pre-wrap">
                          {msg.text.split('\n').map((line, i) => (
                            <span key={i}>
                              {line.split(' ').map((word, j) => {
                                // Clickable custom links like [View](file:///product/id)
                                const linkMatch = word.match(/\[(.*?)\]\(file:\/\/\/(.*?)\)/);
                                if (linkMatch) {
                                  const label = linkMatch[1];
                                  const path = '/' + linkMatch[2];
                                  return (
                                    <button
                                      key={j}
                                      onClick={() => {
                                        setIsOpen(false)
                                        navigate(path)
                                      }}
                                      className="text-pink-600 font-bold underline mx-0.5 hover:text-pink-700"
                                    >
                                      {label}
                                    </button>
                                  )
                                }
                                
                                // Bold parsing (*word*)
                                if (word.startsWith('*') && word.endsWith('*')) {
                                  return <strong key={j} className="font-bold">{word.slice(1, -1)} </strong>
                                }
                                return word + ' '
                              })}
                              {i < msg.text.split('\n').length - 1 && <br />}
                            </span>
                          ))}
                        </p>
                        
                        {/* Timestamp + ticks */}
                        <div className="text-[9px] text-gray-400 text-right mt-1.5 flex items-center justify-end gap-1 select-none">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMe && (
                            <span className="text-[#34b7f1] font-bold text-[10px]">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Typing Simulator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-500 px-3.5 py-2.5 rounded-2xl rounded-tl-none border border-gray-100 text-xs shadow-xs flex items-center gap-1 select-none font-medium italic">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quick Reply Chips Panel */}
          {token && !loading && (
            <div className="bg-white/95 px-3 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto scrollbar-none whitespace-nowrap select-none">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qp.text)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-emerald-100 transition"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          )}

          {/* WhatsApp Style Footer Input bar */}
          <div className="bg-[#f0f2f5] px-3 py-2 flex items-center gap-2 border-t border-gray-200">
            <input
              type="text"
              value={input}
              disabled={!token || sending}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={token ? "Type a message…" : "Log in to chat..."}
              className="flex-1 bg-white border-none rounded-full px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
            />
            
            <button
              onClick={() => handleSend()}
              disabled={!token || sending || !input.trim()}
              className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#008f72] text-white flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-50 transition"
            >
              {sending ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
