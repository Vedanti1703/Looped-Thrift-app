import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner'
import ChatProductCard from '../components/ChatProductCard'
import { useAuth } from '../context/AuthContext'
import { uploadImage } from '../services/uploadService'
import api from '../services/api'

const QUICK_MESSAGES = [
  '🛍️ Show me vintage hoodies under 1500',
  '📦 What is your return policy?',
  '💰 Can I get a discount?',
  '🚚 Delivery timeline details',
  '👗 Recommend an outfit for a trip',
]

export default function ChatPage() {
  const { user, token } = useAuth()
  const navigate        = useNavigate()

  const [conversations, setConversations] = useState([])
  const [activeConvo,   setActiveConvo]   = useState(null)
  const [messages,      setMessages]      = useState([])
  const [input,         setInput]         = useState('')
  const [imagePreview,  setImagePreview]  = useState('')
  const [uploadingImg,  setUploadingImg]  = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [sending,       setSending]       = useState(false)

  const pollRef      = useRef(null)
  const bottomRef    = useRef(null)
  const fileInputRef = useRef(null)

  // Auth check
  if (!token) return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center pb-24 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-3xl mb-3 shadow-xs">
        💬
      </div>
      <p className="font-bold text-gray-800 text-lg mb-1">Sign in to chat</p>
      <p className="text-gray-500 text-xs mb-6 max-w-xs">Ask Looped AI about styles, upload photos for visual search, or chat with sellers.</p>
      <button onClick={() => navigate('/login')} className="btn-primary max-w-xs bg-rose-500 hover:bg-rose-600 border-none shadow-md">
        Sign In
      </button>
    </div>
  )

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    clearInterval(pollRef.current)
    if (activeConvo) {
      fetchMessages(activeConvo._id)
      pollRef.current = setInterval(() => {
        fetchMessages(activeConvo._id, true)
      }, 3000)
    }
    return () => clearInterval(pollRef.current)
  }, [activeConvo?._id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/chat/conversations')
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
    cancelImage()
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingImg(true)
      const url = await uploadImage(file)
      setImagePreview(url)
    } catch (err) {
      console.error('Failed to upload image for chat:', err)
    } finally {
      setUploadingImg(false)
    }
  }

  const cancelImage = () => {
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sendMessage = async (text, overrideImageUrl) => {
    const imgUrl = overrideImageUrl || imagePreview
    const t = (text || input).trim()
    if (!t && !imgUrl) return

    setInput('')
    cancelImage()
    setSending(true)

    const optimistic = {
      _id:       'temp_' + Date.now(),
      senderId:  user._id || user.id,
      senderName: user.name,
      text:      t || (imgUrl ? '📷 Sent a photo for Visual Search' : ''),
      imageUrl:  imgUrl || undefined,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      await api.post('/chat/messages', {
        conversationId: activeConvo._id,
        text: t,
        imageUrl: imgUrl || undefined,
      })
      await fetchMessages(activeConvo._id)
      await fetchConversations()
    } catch {
      setMessages(prev => prev.filter(m => m._id !== optimistic._id))
    } finally {
      setSending(false)
    }
  }

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

  // ── Active Chat Details View (Pinterest Inspired) ───────────
  if (activeConvo) {
    const other = getOtherPerson(activeConvo)
    const isAssistant = other.name === 'Looped AI'

    return (
      <div className="min-h-screen bg-[#fdfbf7] flex flex-col pb-0 font-sans">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Warm Clean Header */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/60 px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => { setActiveConvo(null); fetchConversations() }}
              className="p-1 rounded-full hover:bg-rose-50 text-gray-600 transition"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>

            {isAssistant ? (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center font-bold text-white text-lg flex-shrink-0 shadow-xs">
                🤖
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                {other.initials}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-gray-800">{other.name}</p>
                {isAssistant && (
                  <span className="w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-2xs">✓</span>
                )}
              </div>
              <p className="text-xs text-rose-500/80 font-medium truncate">
                {activeConvo.productTitle || (isAssistant ? 'Personal Thrift Assistant' : '')}
              </p>
            </div>
          </div>

          {activeConvo.productImage && (
            <img
              src={activeConvo.productImage}
              className="w-9 h-9 rounded-xl object-cover border border-rose-200/80 shadow-2xs flex-shrink-0"
              alt=""
            />
          )}
        </div>

        {/* Message feed */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          style={{ paddingBottom: '210px' }}
        >
          {messages.length === 0 && (
            <div className="text-center py-10 px-6 bg-white/70 rounded-3xl border border-rose-100/80 shadow-2xs my-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 mx-auto flex items-center justify-center text-xl mb-2">
                ✨
              </div>
              <p className="font-bold text-gray-800 text-base">Ask Looped AI Anything!</p>
              <p className="text-gray-500 text-xs mt-1 max-w-xs mx-auto">
                Ask about order status, return policies, or ask for clothing recommendations!
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.senderId === user._id || msg.senderId?._id === user._id
            const hasProducts = Array.isArray(msg.suggestedProducts) && msg.suggestedProducts.length > 0

            return (
              <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* User sent photo thumbnail */}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Uploaded photo"
                    onClick={() => window.open(msg.imageUrl, '_blank')}
                    className="max-w-[200px] max-h-[200px] rounded-2xl border border-rose-200/80 object-cover mb-1.5 shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
                  />
                )}

                {/* Bubble Container */}
                {msg.text && (
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-3xl text-sm shadow-xs relative leading-relaxed ${
                      isMe
                        ? 'bg-rose-500 text-white rounded-br-xs'
                        : 'bg-white border border-rose-100/80 text-gray-800 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap font-normal">
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
                                  className="underline font-bold mx-0.5 text-rose-600 hover:text-rose-700"
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

                    <p className={`text-[10px] mt-1.5 text-right font-medium ${isMe ? 'text-rose-200' : 'text-gray-400'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                )}

                {/* Pinterest-inspired Horizontal Product Cards Carousel */}
                {hasProducts && (
                  <div className="w-full mt-2.5 max-w-full">
                    <div className="flex items-center gap-1 mb-1.5 px-1">
                      <span className="text-xs text-rose-500 font-bold">✨ Recommended for you</span>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none max-w-full">
                      {msg.suggestedProducts.map(p => (
                        <ChatProductCard key={p._id || p} product={p} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing / Analyzing Indicator */}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-rose-100/80 px-4 py-3 rounded-3xl rounded-bl-xs text-xs text-gray-600 shadow-xs flex items-center gap-2 font-medium italic">
                <span>Thinking...</span>
                <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Floating Input Area */}
        <div
          className="fixed left-0 right-0 bg-white/95 backdrop-blur-md border-t border-rose-100/80 px-4 pt-2.5 pb-3 max-w-lg mx-auto shadow-lg rounded-t-3xl"
          style={{ bottom: '64px' }}
        >
          {/* Selected Image Preview Thumbnail */}
          {imagePreview && (
            <div className="relative inline-block mb-2.5">
              <img src={imagePreview} className="w-16 h-16 rounded-xl object-cover border-2 border-rose-500 shadow-xs" alt="Preview" />
              <button
                onClick={cancelImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs hover:bg-rose-700"
                title="Remove photo"
              >
                ✕
              </button>
            </div>
          )}

          {/* Quick reply pills */}
          <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none">
            {QUICK_MESSAGES.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all shadow-2xs whitespace-nowrap bg-rose-50/80 hover:bg-rose-100 text-rose-700 border border-rose-200/60"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input control row */}
          <div className="flex items-center gap-2">
            {/* Subtle Camera Upload Icon Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImg || sending}
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-all flex-shrink-0 border border-gray-200 active:scale-95 disabled:opacity-40"
              title="Upload photo for Visual Search"
            >
              {uploadingImg ? (
                <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-base select-none">📷</span>
              )}
            </button>

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="flex-1 bg-gray-100/80 border border-gray-200/60 rounded-full px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-rose-300 focus:bg-white transition-all"
              placeholder={imagePreview ? "Add caption or tap send photo..." : "Type a message..."}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || (!input.trim() && !imagePreview)}
              className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center
                         hover:bg-rose-600 disabled:opacity-40 shadow-md transition-all flex-shrink-0 active:scale-95 text-white"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Conversation List View (Pinterest Inspired) ─────────────
  return (
    <div className="min-h-screen bg-[#fdfbf7] pb-24 font-sans">
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100/60 px-4 py-4 flex items-center justify-between shadow-2xs">
        <div>
          <h1 className="font-bold text-gray-900 text-xl tracking-tight">Messages</h1>
          <p className="text-xs text-rose-500 font-medium">Curated Thrift & AI Assistant</p>
        </div>
        <button onClick={fetchConversations} className="p-2 rounded-full hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {loading ? (
        <Spinner center />
      ) : conversations.length === 0 ? (
        <div className="text-center py-24 px-6">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-500 mx-auto flex items-center justify-center text-2xl mb-3 shadow-xs">
            💬
          </div>
          <p className="font-bold text-gray-800 text-lg">No messages yet</p>
          <p className="text-gray-400 text-xs mt-1 mb-6">
            Find something you like and tap "Chat with Seller" or talk to Looped AI
          </p>
          <button onClick={() => navigate('/discover')} className="btn-primary max-w-xs mx-auto bg-rose-500 hover:bg-rose-600 border-none shadow-md">
            Browse Items
          </button>
        </div>
      ) : (
        <div className="px-3 pt-3 space-y-2.5">
          {conversations.map(convo => {
            const other       = getOtherPerson(convo)
            const unread      = getUnreadCount(convo)
            const isAssistant = other.name === 'Looped AI'

            return (
              <button
                key={convo._id}
                onClick={() => openConversation(convo)}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-3xl transition-all text-left shadow-xs border ${
                  isAssistant
                    ? 'bg-gradient-to-r from-rose-50/90 to-amber-50/80 border-rose-200/80 hover:border-rose-300'
                    : 'bg-white border-rose-100/60 hover:border-rose-200'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {isAssistant ? (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-400 to-amber-300 flex items-center justify-center text-xl font-bold text-white shadow-xs">
                      🤖
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-base shadow-xs">
                      {other.initials}
                    </div>
                  )}

                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white
                                     text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                      {unread}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm ${unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {other.name}
                      </p>
                      {isAssistant && (
                        <span className="w-3.5 h-3.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">✓</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(convo.lastMessageAt)}
                    </p>
                  </div>
                  <p className="text-xs text-rose-500 font-medium truncate mb-0.5">
                    {convo.productTitle || (isAssistant ? 'AI Assistant' : '')}
                  </p>
                  <p className={`text-xs truncate ${unread > 0 ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                    {convo.lastMessage || 'Start the conversation'}
                  </p>
                </div>

                {/* Product thumbnail */}
                {convo.productImage && (
                  <img
                    src={convo.productImage}
                    className="w-11 h-11 rounded-2xl object-cover flex-shrink-0 border border-rose-100 shadow-2xs"
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
