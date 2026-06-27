// src/components/AiChat.jsx
// ─────────────────────────────────────────────
// Floating AI chat assistant that appears on every screen.
// Renders as a small bubble button fixed at bottom right.
// Tapping opens a chat panel that slides up from the bottom.
//
// Works for all three user types — buyer, farmer, provider.
// The quick-tap buttons change based on the user's role.
// ─────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { askClaude } from '../lib/claude'
import { useAuth } from '../lib/AuthContext'

const QUICK_QUESTIONS = {
  buyer: [
    { label: 'Price check', q: 'Are current tomato prices fair in Nigeria right now?' },
    { label: 'Delivery cost', q: 'How much should delivery from Lagos to Abuja cost for 10 bags of yam?' },
    { label: 'How escrow works', q: 'How does Naagora protect my payment?' },
    { label: 'Best produce to buy', q: 'What produce is freshest and best value right now?' },
  ],
  farmer: [
    { label: 'Price my product', q: 'What is the current market price for tomatoes per crate in Nigeria?' },
    { label: 'Write my listing', q: 'Write a product description for fresh tomatoes from Ogun State, harvested 2 days ago, 42 crates available at ₦4,500 each.' },
    { label: 'What is in demand', q: 'What produce are buyers looking for most on Naagora this week?' },
    { label: 'When to sell', q: 'When is the best time to sell yam for the highest price in Nigeria?' },
  ],
  provider: [
    { label: 'Price a haulage job', q: 'How much should I charge to haul 5 tonnes of yam from Kwara to Lagos?' },
    { label: 'Fuel cost estimate', q: 'What is the estimated diesel cost for a Lagos to Port Harcourt trip right now?' },
    { label: 'Write my service listing', q: 'Write a service description for a 5-tonne truck offering Lagos and Ogun State farm pickups.' },
    { label: 'Peak seasons', q: 'What are the busiest haulage seasons for agricultural produce in Nigeria?' },
  ],
}

export default function AiChat() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // [{role, content}]
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const role = profile?.role || 'buyer'
  const quickQs = QUICK_QUESTIONS[role] || QUICK_QUESTIONS.buyer
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  // Greeting changes based on role
  const greeting = role === 'farmer'
    ? `Hi ${firstName}! I can help you price your produce, write listings, or spot what buyers want. What do you need?`
    : role === 'provider'
      ? `Hi ${firstName}! I can help you price haulage jobs, write your service listing, or find peak seasons. What do you need?`
      : `Hi ${firstName}! I can check prices, estimate delivery costs, or explain how Naagora works. What do you need?`

  useEffect(() => {
    if (open) {
      setUnread(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userText }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const reply = await askClaude(newMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (!open) setUnread(true)
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please check your internet and try again.'
      }])
    }
    setLoading(false)
  }

  function clearChat() {
    setMessages([])
  }

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open Naagora AI assistant"
        style={{
          position: 'fixed', bottom: 84, right: 16, zIndex: 50,
          width: 48, height: 48, borderRadius: '50%',
          background: '#0F6E56', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, boxShadow: '0 2px 12px rgba(15,110,86,0.35)'
        }}
      >
        {open ? '×' : '✦'}
        {unread && !open && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            width: 12, height: 12, background: '#D85A30',
            borderRadius: '50%', border: '2px solid #fff'
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          maxWidth: 480, margin: '0 auto',
          background: 'var(--surface-2, #fff)',
          borderTop: '0.5px solid var(--border, rgba(0,0,0,0.1))',
          borderRadius: '16px 16px 0 0',
          display: 'flex', flexDirection: 'column',
          height: '70vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.08)'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '0.5px solid var(--border, rgba(0,0,0,0.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--text-primary, #1a1a18)' }}>
                  Naagora AI
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                  Prices · listings · delivery costs
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {messages.length > 0 && (
                <button onClick={clearChat} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-muted, #888)', fontFamily: 'inherit'
                }}>
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: 'var(--text-muted, #888)', lineHeight: 1,
                fontFamily: 'inherit'
              }}>×</button>
            </div>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Greeting */}
            <div style={{
              background: '#E1F5EE', color: '#085041',
              padding: '10px 12px', borderRadius: '10px 10px 10px 2px',
              fontSize: 13, lineHeight: 1.5, alignSelf: 'flex-start', maxWidth: '85%'
            }}>
              {greeting}
            </div>

            {/* Quick question chips — only show when no messages yet */}
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0' }}>
                {quickQs.map(q => (
                  <button
                    key={q.label}
                    onClick={() => send(q.q)}
                    style={{
                      fontSize: 11, padding: '5px 10px',
                      border: '0.5px solid rgba(15,110,86,0.3)',
                      borderRadius: 16, background: '#E1F5EE',
                      color: '#085041', cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    {q.label} ↗
                  </button>
                ))}
              </div>
            )}

            {/* Conversation messages */}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? '#0F6E56' : 'var(--surface-1, #f7f6f2)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary, #1a1a18)',
                padding: '10px 12px',
                borderRadius: msg.role === 'user'
                  ? '10px 10px 2px 10px'
                  : '10px 10px 10px 2px',
                fontSize: 13, lineHeight: 1.6,
                border: msg.role === 'assistant' ? '0.5px solid var(--border, rgba(0,0,0,0.1))' : 'none',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'var(--surface-1, #f7f6f2)',
                border: '0.5px solid var(--border, rgba(0,0,0,0.1))',
                padding: '10px 14px', borderRadius: '10px 10px 10px 2px',
                display: 'flex', gap: 4, alignItems: 'center'
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#0F6E56', opacity: 0.4,
                    animation: `bounce 1s ${i * 0.2}s infinite`
                  }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '10px 16px 16px', flexShrink: 0,
            borderTop: '0.5px solid var(--border, rgba(0,0,0,0.1))'
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about prices, delivery, listings..."
                style={{
                  flex: 1, padding: '10px 12px',
                  border: '0.5px solid rgba(0,0,0,0.15)',
                  borderRadius: 10, fontSize: 13,
                  fontFamily: 'inherit', outline: 'none',
                  background: 'var(--surface-1, #f7f6f2)',
                  color: 'var(--text-primary, #1a1a18)'
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                style={{
                  background: input.trim() && !loading ? '#0F6E56' : 'rgba(0,0,0,0.1)',
                  color: input.trim() && !loading ? '#fff' : 'rgba(0,0,0,0.3)',
                  border: 'none', borderRadius: 10,
                  padding: '10px 14px', cursor: input.trim() ? 'pointer' : 'default',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  transition: 'background 0.15s'
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
