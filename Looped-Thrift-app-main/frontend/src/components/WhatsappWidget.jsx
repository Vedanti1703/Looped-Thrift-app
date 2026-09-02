import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { uploadImage } from '../services/uploadService'
import api from '../services/api'
import Spinner from './Spinner'
import ChatProductCard from './ChatProductCard'

const QUICK_PROMPTS = [
  { label: '🛍️ Order an Item', text: 'I want to place an order' },
  { label: '📦 Return Policy', text: 'What is your return policy?' },
  { label: '💰 Get Discount', text: 'Can I get a discount?' },
  { label: '🚚 Delivery Details', text: 'How long does delivery take?' },
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
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImg, setUploadingImg] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const pollRef = useRef(null)
  const listRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) setShowBadge(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, sending, isOpen])

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
      setMessages(res.data.messages)
    } catch (err) {
      console.error(err)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingImg(true)
      const url = await uploadImage(file)
      setImagePreview(url)
    } catch (err) {
      console.error('Failed to upload image:', err)
    } finally {
      setUploadingImg(false)
    }
  }

  const cancelImage = () => {
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (overrideText, overrideImageUrl) => {
    const imgUrl = overrideImageUrl || imagePreview
    const textToSend = (overrideText || input).trim()
    if (!textToSend && !imgUrl || !convo) return

    setInput('')
    cancelImage()
    setSending(true)

    const optimisticMessage = {
      _id: 'temp_' + Date.now(),
      senderId: user._id || user.id,
      senderName: user.name || 'You',
      text: textToSend || (imgUrl ? '📷 Sent a photo for Visual Search' : ''),
      imageUrl: imgUrl || undefined,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimisticMessage])

    try {
      await api.post('/chat/messages', {
        conversationId: convo._id,
        text: textToSend,
        imageUrl: imgUrl || undefined
      })
      await fetchMessages(convo._id)
    } catch (err) {
      console.error(err)
      setMessages(prev => prev.filter(m => m._id !== optimisticMessage._id))
    } finally {
      setSending(false)
    }
  }

  const toggleWidget = () => {
    setIsOpen(!isOpen)
    setShowBadge(false)
  }

  if (location.pathname === '/chat') return null

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-[calc(100vw-32px)]">

      {/* Floating Action Button */}
      <button
        onClick={toggleWidget}
        className={`w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white flex items-center justify-center shadow-xl active:scale-95 transition-all relative ${
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
          <span className="text-2xl select-none">💬</span>
        )}

        {!isOpen && showBadge && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-white text-[9px] font-bold items-center justify-center">1</span>
          </span>
        )}
      </button>

      {/* WhatsApp Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 h-[480px] bg-[#fdfbf7] rounded-3xl border border-rose-100/90 shadow-2xl flex flex-col overflow-hidden animate-slide-up font-sans">

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Header */}
          <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-4 py-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg font-bold text-white border border-white/30 shadow-xs">
                  🤖
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-rose-600 rounded-full"></span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-tight">Looped AI</h3>
                  <span className="w-3.5 h-3.5 bg-white/30 text-white rounded-full flex items-center justify-center text-[8px] font-bold">✓</span>
                </div>
                <p className="text-[10px] text-rose-100/90 font-medium">Visual Search & AI Assistant</p>
              </div>
            </div>

            <button onClick={toggleWidget} className="p-1 text-rose-100 hover:text-white transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-3.5 space-y-3 relative bg-[#fdfbf7]"
          >
            {!token ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-white/90 backdrop-blur rounded-3xl border border-rose-100 shadow-xs">
                <span className="text-4xl mb-2.5">💬</span>
                <p className="font-bold text-gray-800 text-sm">Sign in to chat with Looped AI</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Looped AI helps you discover items via text or photo, order, and track deliveries.</p>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/login')
                  }}
                  className="btn-primary py-2 px-6 text-xs bg-rose-500 hover:bg-rose-600 border-none shadow-md"
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
                  <div className="text-center py-6 text-xs text-gray-400 font-medium italic">
                    Looped AI is ready. Type or tap 📷 to send a photo 👋
                  </div>
                )}

                {messages.map((msg) => {
                  const isMe = msg.senderId === user._id || msg.senderId === user.id
                  const hasProducts = Array.isArray(msg.suggestedProducts) && msg.suggestedProducts.length > 0

                  return (
                    <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded photo"
                          onClick={() => window.open(msg.imageUrl, '_blank')}
                          className="max-w-[180px] max-h-[180px] rounded-2xl border border-rose-200 object-cover mb-1 shadow-2xs cursor-pointer hover:opacity-95"
                        />
                      )}

                      {msg.text && (
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs relative shadow-xs leading-relaxed ${
                            isMe
                              ? 'bg-rose-500 text-white rounded-tr-xs font-normal'
                              : 'bg-white text-gray-800 rounded-tl-xs border border-rose-100/80 font-normal'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">
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
                                        onClick={() => {
                                          setIsOpen(false)
                                          navigate(path)
                                        }}
                                        className="text-rose-600 font-bold underline mx-0.5 hover:text-rose-700"
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

                          <div className={`text-[9px] text-right mt-1 font-medium ${isMe ? 'text-rose-200' : 'text-gray-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      )}

                      {/* Product Suggestions Carousel */}
                      {hasProducts && (
                        <div className="w-full mt-2">
                          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none max-w-full">
                            {msg.suggestedProducts.map(p => (
                              <ChatProductCard key={p._id || p} product={p} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-rose-100 px-3 py-2 rounded-2xl rounded-tl-xs text-xs text-gray-500 shadow-xs flex items-center gap-1.5 italic font-medium">
                      <span>Analyzing photo & searching catalog...</span>
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Image Preview thumbnail if selected */}
          {imagePreview && (
            <div className="bg-white px-3 pt-2 pb-0 flex items-center border-t border-rose-100">
              <div className="relative inline-block">
                <img src={imagePreview} className="w-12 h-12 rounded-xl object-cover border-2 border-rose-500" alt="Preview" />
                <button
                  onClick={cancelImage}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
              <span className="text-[10px] text-rose-600 font-bold ml-2">📷 Photo attached for Visual Search</span>
            </div>
          )}

          {/* Quick Reply Pills */}
          {token && !loading && (
            <div className="bg-white/95 px-3 py-2 border-t border-rose-100/60 flex gap-2 overflow-x-auto scrollbar-none whitespace-nowrap select-none">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qp.text)}
                  className="text-[11px] font-semibold px-3 py-1 rounded-full transition shadow-2xs border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          )}

          {/* Footer Input Bar */}
          <div className="bg-white px-3 py-2.5 flex items-center gap-2 border-t border-rose-100">
            {/* Camera Photo Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImg || sending}
              className="w-9 h-9 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-40 flex-shrink-0 border border-gray-200"
              title="Upload photo for Visual Search"
            >
              {uploadingImg ? (
                <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-base select-none">📷</span>
              )}
            </button>

            <input
              type="text"
              value={input}
              disabled={!token || sending}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={token ? "Type or tap 📷 for photo..." : "Log in to chat..."}
              className="flex-1 bg-gray-100/80 border border-gray-200/60 rounded-full px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400 transition-all"
            />

            <button
              onClick={() => handleSend()}
              disabled={!token || sending || (!input.trim() && !imagePreview)}
              className="w-9 h-9 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-40 transition flex-shrink-0"
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
