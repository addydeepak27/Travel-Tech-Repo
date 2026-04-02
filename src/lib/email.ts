const resendKey = process.env.RESEND_API_KEY ?? ''
const FROM = 'Toh Chale <noreply@tohchale.com>'

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!to || !to.includes('@')) {
    console.warn('[Email] Invalid recipient:', to)
    return
  }

  if (!resendKey) {
    console.log(`[Email MOCK] to=${to}\nSubject: ${subject}\n${body}\n`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text: body }),
  })

  if (!res.ok) {
    console.error('[Email] Send failed:', await res.text())
  }
}
