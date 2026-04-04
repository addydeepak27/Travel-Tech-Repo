const resendKey = process.env.RESEND_API_KEY ?? ''
// Use resend.dev test address until tohchale.com domain is verified in Resend dashboard
const FROM = process.env.RESEND_FROM ?? 'Toh Chale <onboarding@resend.dev>'

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

  const responseText = await res.text()
  if (!res.ok) {
    console.error(`[Email] Send FAILED to=${to} status=${res.status}:`, responseText)
    // Resend test-domain restriction: onboarding@resend.dev can only send to your Resend account email.
    // If you see a 403 here, either verify a custom domain at resend.com/domains
    // or set RESEND_FROM to a verified sending address.
  } else {
    console.log(`[Email] Sent OK to=${to} subject="${subject}"`, responseText)
  }
}
