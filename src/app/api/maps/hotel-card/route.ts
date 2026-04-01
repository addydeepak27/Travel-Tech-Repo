import { NextRequest, NextResponse } from 'next/server'

// Returns a cached static map image for a hotel card.
// Google Maps Static API: 640×360, hotel pin centred, zoom 15.
// Falls back to a plain SVG placeholder if the API key is missing.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const name = searchParams.get('name') ?? 'Hotel'

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    // Return a minimal SVG placeholder with pin icon
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#1a1a2e"/>
      <rect x="0" y="0" width="640" height="360" fill="#141430" opacity="0.5"/>
      <!-- Grid lines -->
      <line x1="0" y1="120" x2="640" y2="120" stroke="#2a2a4a" stroke-width="1"/>
      <line x1="0" y1="240" x2="640" y2="240" stroke="#2a2a4a" stroke-width="1"/>
      <line x1="213" y1="0" x2="213" y2="360" stroke="#2a2a4a" stroke-width="1"/>
      <line x1="426" y1="0" x2="426" y2="360" stroke="#2a2a4a" stroke-width="1"/>
      <!-- Pin -->
      <circle cx="320" cy="170" r="20" fill="#6366f1"/>
      <text x="320" y="177" text-anchor="middle" fill="white" font-size="18">📍</text>
      <text x="320" y="220" text-anchor="middle" fill="#a0a0c0" font-size="14">${name.replace(/[<>&"]/g, '')}</text>
      <text x="320" y="240" text-anchor="middle" fill="#666" font-size="11">${lat}, ${lng}</text>
    </svg>`
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  // Fetch from Google Maps Static API
  const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap')
  mapUrl.searchParams.set('center', `${lat},${lng}`)
  mapUrl.searchParams.set('zoom', '15')
  mapUrl.searchParams.set('size', '640x360')
  mapUrl.searchParams.set('scale', '2')
  mapUrl.searchParams.set('maptype', 'roadmap')
  mapUrl.searchParams.set('markers', `color:0x6366f1|${lat},${lng}`)
  mapUrl.searchParams.set('style', 'element:geometry|color:0x212121')
  mapUrl.searchParams.set('style', 'element:labels.text.fill|color:0x757575')
  mapUrl.searchParams.set('key', apiKey)

  try {
    const res = await fetch(mapUrl.toString())
    if (!res.ok) throw new Error('Maps API error')

    const imageBuffer = await res.arrayBuffer()
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
        'Cache-Control': 'public, max-age=604800', // 7 days
      },
    })
  } catch {
    // Return placeholder on error
    return NextResponse.json({ error: 'Map unavailable' }, { status: 502 })
  }
}
