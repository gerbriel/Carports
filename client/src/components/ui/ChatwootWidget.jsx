import { useEffect } from 'react'

const BASE_URL = import.meta.env.VITE_CHATWOOT_URL || 'https://support.qualitymetalcarportsca.com'
const WEBSITE_TOKEN = import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN

/**
 * Identifies the current visitor to Chatwoot.
 * Call this after a user submits the contact form or books a call
 * so agents can see their name and email immediately.
 *
 * identifyChatwootVisitor({ name: 'John Doe', email: 'john@example.com', phone: '5595550000' })
 */
export function identifyChatwootVisitor({ name, email, phone } = {}) {
  if (!window.$chatwoot) return
  window.$chatwoot.setUser(email || 'visitor', {
    name: name || undefined,
    email: email || undefined,
    phone_number: phone ? `+1${phone.replace(/\D/g, '')}` : undefined,
  })
}

/**
 * Sets custom attributes on the Chatwoot conversation.
 * Useful for tagging a chat with "Quote Request", "Post-Install", etc.
 *
 * setChatwootConversationLabel('quote-request')
 */
export function setChatwootConversationLabel(label) {
  if (!window.$chatwoot) return
  window.$chatwoot.setLabel(label)
}

/**
 * Programmatically opens the chat widget.
 * Link this to your "Live Chat" buttons.
 */
export function openChatwoot() {
  if (window.$chatwoot) window.$chatwoot.toggle('open')
}

export default function ChatwootWidget() {
  useEffect(() => {
    if (!WEBSITE_TOKEN) return
    if (document.getElementById('chatwoot-sdk')) return

    window.chatwootSettings = {
      position: 'right',
      type: 'standard',
      launcherTitle: 'Chat with Us',
    }

    const script = document.createElement('script')
    script.id = 'chatwoot-sdk'
    script.src = `${BASE_URL}/packs/js/sdk.js`
    script.defer = true
    script.async = true
    script.onload = () => {
      window.chatwootSDK.run({ websiteToken: WEBSITE_TOKEN, baseUrl: BASE_URL })
    }
    document.head.appendChild(script)
  }, [])

  return null
}
