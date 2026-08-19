addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CITY_MAP = {
  '62': 'narsingpur',
  '59': 'jabalpur',
  '33': 'bhopal',
  '74': 'indore',
  '52': 'gwalior',
  '50': 'raipur',
  '4': 'ujjain',
  '6': 'ratlam',
  '65': 'damoh',
  '63': 'katni',
  '64': 'satna',
  '75': 'seoni',
  '40': 'chhindwara',
  '20': 'mandla',
  '61': 'shahadol',
  '60': 'balaghat',
  '71': 'bilaspur'
}

const MONTHS_LOWER = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(request.url)

  // 1. Date & Edition Params
  let dateParam = url.searchParams.get('date') || '2026-08-19'
  const eid = url.searchParams.get('eid') || '62'
  const cityName = CITY_MAP[eid] || 'narsingpur'

  // Date Parsing
  const [year, monthNum, dayNum] = dateParam.split('-')
  const day = String(parseInt(dayNum, 10)).padStart(2, '0')
  const monthLower = MONTHS_LOWER[parseInt(monthNum, 10) - 1] || 'aug'

  // 2. Exact Lowercase Target URL
  const targetPageUrl = `https://epaper.naidunia.com/${day}-${monthLower}-${year}-${eid}-${cityName}-edition-${cityName}-page-1.html`

  try {
    const pageResponse = await fetch(targetPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Referer': 'https://epaper.naidunia.com/'
      }
    })

    if (!pageResponse.ok) {
      throw new Error(`Naidunia page error: HTTP ${pageResponse.status} for URL: ${targetPageUrl}`)
    }

    const html = await pageResponse.text()

    // 3. Flexible NEXT_DATA Regex Match
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
    if (!nextDataMatch || !nextDataMatch[1]) {
      throw new Error('__NEXT_DATA__ tag HTML me nahi mila.')
    }

    const nextData = JSON.parse(nextDataMatch[1])
    const pageProps = nextData?.props?.pageProps || nextData?.pageProps || {}
    const rawPages = pageProps?.data || []

    if (!rawPages || rawPages.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: `${day}-${monthLower}-${year} ka e-paper uplabdh nahi hai.`,
        pages: []
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Sanitize Clean Data Structure
    const sanitizedPages = rawPages.map(page => ({
      pageno: page.pageno,
      page_image: page.page_image,
      page_largeimage: page.page_largeimage,
      page_pdf: page.page_pdf,
      formattedCity: page.formattedCity || cityName,
      formattedDate: page.formattedDate || `${day} ${monthLower.toUpperCase()} ${year}`
    }))

    const finalResponse = {
      success: true,
      meta: {
        eid: eid,
        city: sanitizedPages[0]?.formattedCity || cityName,
        date: dateParam,
        formattedDate: sanitizedPages[0]?.formattedDate,
        total_pages: sanitizedPages.length
      },
      pages: sanitizedPages,
      pageProps: {
        data: sanitizedPages
      }
    }

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800'
      }
    })

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      targetUrl: targetPageUrl
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
