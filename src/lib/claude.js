// src/lib/claude.js
// ─────────────────────────────────────────────
// AI client for the Naagora assistant.
// Uses Google Gemini free tier.
//
// Updated to support new Google Auth keys (AQ.Ab8... format)
// which require the key sent as a header, not a URL param.
// ─────────────────────────────────────────────

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const SYSTEM_PROMPT = `You are Naagora AI, a helpful assistant built into the Naagora agricultural marketplace app in Nigeria.

Naagora is a three-sided marketplace connecting:
- Farmers who sell produce (tomatoes, yam, pepper, vegetables, grains etc.)
- Buyers who purchase farm produce
- Logistics providers (3PL) who offer haulage and delivery services

Your job is to help users with:
1. PRICE CHECKS — Tell buyers and farmers if a price is fair based on current Nigerian market rates. Give realistic price ranges for common Nigerian produce.
2. DELIVERY COST ESTIMATES — Estimate realistic haulage costs between Nigerian states. Use zone-based pricing: same state cheapest, neighbouring states mid-range, cross-region premium. A Lagos to Kano trip for a 5-tonne truck typically costs ₦150,000-₦250,000 depending on load.
3. PRODUCT LISTING HELP — Write compelling product descriptions for farmers listing produce.
4. DEMAND TRENDS — Explain which produce is typically in high demand by season in Nigeria.
5. ORDER QUESTIONS — Explain what order statuses mean and what the user should do next.
6. GENERAL FARMING ADVICE — Basic advice relevant to Nigerian agriculture.

Always respond in clear simple English. Keep answers short and practical — users are on mobile phones.
When giving prices always say they are estimates and market rates change daily.
If someone writes in Pidgin English respond naturally in a mix of English and Pidgin.
Never make up specific platform data you do not have.`

/**
 * Sends a message to Gemini and returns the AI response.
 * Supports both old standard keys (AIza...) and new auth keys (AQ.Ab8...)
 * @param {Array} messages - conversation history [{role, content}]
 * @returns {Promise<string>} AI response text
 */
export async function askClaude(messages) {
  if (!API_KEY) {
    throw new Error('AI is not configured. Please contact Naagora support.')
  }

  // New auth keys (AQ...) go in the header
  // Old standard keys (AIza...) go in the URL param
  // We support both by sending both — only one will work depending on key type
  const isAuthKey = API_KEY.startsWith('AQ.')
  const url = isAuthKey
    ? GEMINI_API
    : `${GEMINI_API}?key=${API_KEY}`

  const headers = { 'Content-Type': 'application/json' }
  if (isAuthKey) {
    headers['x-goog-api-key'] = API_KEY
  }

  // Convert our message format to Gemini's format
  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }))

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
      }
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    console.error('Gemini error:', err)

    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.')
    }
    if (response.status === 400) {
      throw new Error('AI configuration error. Please contact Naagora support.')
    }
    if (response.status === 403) {
      throw new Error('AI access denied. Please contact Naagora support.')
    }
    throw new Error('AI request failed. Check your connection and try again.')
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  return text || 'Sorry, I could not generate a response. Please try again.'
}
