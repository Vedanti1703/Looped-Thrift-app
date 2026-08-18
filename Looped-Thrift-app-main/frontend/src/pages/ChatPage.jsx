import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const QUICK_MESSAGES = [
  'Is this still available?',
  'Can you do a lower price?',
  'What is the fabric?',
  'Can I see more photos?',
  'What size is this?',
  'When can you ship?',
]

export default function ChatPage() {
  const { user, token } = useAuth()
  const navigate        = useNavigate()

  const [conversations, setConversations] = useState([])
  const [activeConvo,   setActiveConvo]   = useState(null)
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [loading,       setLoading]       = useState(true)
  const [sending,       setSending]       = useState(false)

  const pollRef    = useRef(null)
  const bottomRef  = useRef(null)

  // ── Auth gate ─────────────────────────────────────────────
  if (!token) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center pb-24 text-center px-6">
      <p className="text-4xl mb-3">💬</p>
      <p className="font-semibold text-gray-700 mb-4">Sign in to chat with sellers</p>
      <button onClick={() => navigate('/login')} className="btn-primary max-w-xs">Sign In</button>
    </div>
  )

  // ── Load conversations on mount ───────────────────────────
  useEffect(() => {
    fetchConversations()
  }, [])

  // ── Poll for new messages when a chat is open ─────────────
  useEffect(() => {
    clearInterval(pollRef.current)
    if (activeConvo) {
      fetchMessages(activeConvo._id)
      // Poll every 3 seconds for new messages
      pollRef.current = setInterval(() => {
        fetchMessages(activeConvo._id, true) // silent=true (no loading spinner)
      }, 3000)
    }
    return () => clearInterval(pollRef.current)
  }, [activeConvo?._id])

  // ── Auto-scroll to bottom when messages update ────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/chat/conversations')
      // Sort: pin Looped AI at the top
      const sorted = [...res.data].sort((a, b) => {
        if (a.sellerName === 'Looped AI') return -1;
        if (b.sellerName === 'Looped AI') return 1;
        return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      });
      setConversations(sorted)
    } catch {}
    finally { setLoading(false) }
  }

  const fetchMessages = async (convoId, silent = false) => {
    try {
      const res = await api.get(`/chat/messages/${convoId}`)
      setMessages(res.data.messages)
      // Update unread counts in conversation list
      setConversations(prev => {
        const updated = prev.map(c =>
          c._id === convoId
            ? { ...c,
                unreadBuyer:  res.data.conversation.unreadBuyer,
                unreadSeller: res.data.conversation.unreadSeller }
            : c
        );
        return updated.sort((a, b) => {
          if (a.sellerName === 'Looped AI') return -1;
          if (b.sellerName === 'Looped AI') return 1;
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        });
      })
    } catch {}
  }

  const openConversation = (convo) => {
    setActiveConvo(convo)
    setMessages([])
  }

  const sendMessage = async (text) => {
    const t = (text || input).trim()
    if (!t || !activeConvo) return
    setInput('')
    setSending(true)

    // Optimistic update — show message immediately
    const optimistic = {
      _id:       'temp_' + Date.now(),
      senderId:  user._id || user.id,
      senderName: user.name,
      text:      t,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      await api.post('/chat/messages', {
        conversationId: activeConvo._id,
        text: t,
      })
      // Fetch real messages to replace optimistic
      await fetchMessages(activeConvo._id)
      await fetchConversations() // update last message in list
    } catch {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m._id !== optimistic._id))
    } finally {
      setSending(false)
    }
  }

  // ── Other person's name and avatar ───────────────────────
  const getOtherPerson = (convo) => {
    const isBuyer = convo.buyerId === user._id || convo.buyerId?._id === user._id
    return {
      name:   isBuyer ? convo.sellerName : convo.buyerName,
      initials: (isBuyer ? convo.sellerName : convo.buyerName)?.[0]?.toUpperCase() || '?',
    }
  }

  const getUnreadCount = (convo) => {
    const isBuyer = convo.buyerId === user._id || convo.buyerId?._id === user._id
    return isBuyer ? convo.unreadBuyer : convo.unreadSeller
  }

  const formatTime = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMins = Math.floor((now - d) / 60000)
    if (diffMins < 1)  return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffMins < 1440) return `${Math.floor(diffMins/60)}h`
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // ── Chat detail view ──────────────────────────────────────
  if (activeConvo) {
    const other = getOtherPerson(activeConvo)
    const isAssistant = other.name === 'Looped AI'
    
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-0">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setActiveConvo(null); fetchConversations() }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          
          {isAssistant ? (
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-sm flex-shrink-0 shadow-xs border border-white">
              🤖
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center font-bold text-pink-600 text-sm flex-shrink-0">
              {other.initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm text-gray-800">{other.name}</p>
              {isAssistant && (
                <span className="w-3.5 h-3.5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">✓</span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{activeConvo.productTitle || (isAssistant ? 'WhatsApp Assistant' : '')}</p>
          </div>
          {/* Product thumbnail */}
          {activeConvo.productImage && (
            <img
              src={activeConvo.productImage}
              className="w-9 h-9 rounded-xl object-cover border border-pink-100 flex-shrink-0"
              alt=""
            />
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
             style={{ paddingBottom: '180px' }}>

          {messages.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Say hi! Ask about the item 👋
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.senderId === user._id ||
                         msg.senderId?._id === user._id
            return (
              <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm
                  ${isMe
                    ? 'bg-pink-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                  
                  {/* Message Formatter */}
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {msg.text.split('\n').map((line, i) => (
                      <span key={i}>
                        {line.split(' ').map((word, j) => {
                          const linkMatch = word.match(/\[(.*?)\]\(file:\/\/\/(.*?)\)/);
                          if (linkMatch) {
                            const label = linkMatch[1];
                            const path = '/' + linkMatch[2];
                            return (
                              <button
                                key={j}
                                onClick={() => navigate(path)}
                                className="underline font-bold mx-0.5 text-pink-600 hover:text-pink-700"
                              >
                                {label}
                              </button>
                            )
                          }
                          if (word.startsWith('*') && word.endsWith('*')) {
                            return <strong key={j} className="font-bold">{word.slice(1, -1)} </strong>
                          }
                          return word + ' '
                        })}
                        {i < msg.text.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </p>

                  <p className={`text-[10px] mt-1 ${isMe ? 'text-pink-200' : 'text-gray-400'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area — sits above BottomNav (64px) */}
        <div className="fixed left-0 right-0 bg-white border-t border-gray-100 px-4 pt-2 pb-3 max-w-lg mx-auto"
             style={{ bottom: '64px' }}>
          {/* Quick reply chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {QUICK_MESSAGES.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="flex-shrink-0 text-xs bg-pink-50 text-pink-600 border border-pink-200
                           px-3 py-1.5 rounded-full hover:bg-pink-100 transition-colors whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>
          {/* Text input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-pink-300"
              placeholder="Type a message…"
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center
                         hover:bg-pink-600 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
              }
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Conversations list ────────────────────────────────────
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-pink-100 px-4 py-4 flex items-center justify-between">
        <h1 className="font-bold text-gray-900 text-lg">Messages</h1>
        {/* Refresh button */}
        <button onClick={fetchConversations} className="text-gray-400 hover:text-pink-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {loading ? (
        <Spinner center />
      ) : conversations.length === 0 ? (
        <div className="text-center py-24 px-6">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold text-gray-700">No messages yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-6">
            Find something you like and tap "Chat with Seller"
          </p>
          <button onClick={() => navigate('/discover')} className="btn-primary max-w-xs mx-auto">
            Browse Items
          </button>
        </div>
      ) : (
        <div className="divide-y divide-pink-50">
          {conversations.map(convo => {
            const other   = getOtherPerson(convo)
            const unread  = getUnreadCount(convo)
            const isAssistant = other.name === 'Looped AI'
            
            return (
              <button
                key={convo._id}
                onClick={() => openConversation(convo)}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-pink-50 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {isAssistant ? (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-lg border border-emerald-200 shadow-xs">
                      🤖
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center font-bold text-pink-600 text-lg">
                      {other.initials}
                    </div>
                  )}
                  
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-pink-500 text-white
                                     text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm ${unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {other.name}
                      </p>
                      {isAssistant && (
                        <span className="w-3.5 h-3.5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(convo.lastMessageAt)}
                    </p>
                  </div>
                  <p className="text-xs text-pink-400 truncate mb-0.5">{convo.productTitle || (isAssistant ? 'WhatsApp Assistant' : '')}</p>
                  <p className={`text-xs truncate ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {convo.lastMessage || 'Start the conversation'}
                  </p>
                </div>

                {/* Product image */}
                {convo.productImage && (
                  <img
                    src={convo.productImage}
                    className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-pink-100"
                    alt=""
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
