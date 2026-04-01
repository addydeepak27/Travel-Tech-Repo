import twilio from 'twilio'

const sid = process.env.TWILIO_ACCOUNT_SID || ''
const token = process.env.TWILIO_AUTH_TOKEN || ''
const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

// Only initialise the real client when credentials are present
const client = sid && token ? twilio(sid, token) : null

export async function sendWhatsApp(to: string, body: string) {
  if (!client) {
    // Credentials not set — log locally so the flow continues without crashing
    console.log(`[WhatsApp MOCK] to=${to}\n${body}\n`)
    return
  }
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  return client.messages.create({ from: FROM, to: toFormatted, body })
}

export async function sendWhatsAppWithButtons(
  to: string,
  body: string,
  _options?: string[]
) {
  if (!client) {
    console.log(`[WhatsApp MOCK] to=${to}\n${body}\n`)
    return
  }
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  return client.messages.create({ from: FROM, to: toFormatted, body })
}

export function formatPhone(raw: string): string {
  // Normalise Indian numbers: strip spaces, ensure +91 prefix
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}
