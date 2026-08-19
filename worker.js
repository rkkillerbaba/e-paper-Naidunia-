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

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

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
  let dateParam = url.searchParams.get('date') || '2026-08-19'
  const eid = url.searchParams.get('eid') || '62'
  const cityName = CITY_MAP[eid] || 'narsingpur'

  // Date Parsing
  const [year, monthNum, dayNum] = dateParam.split('-')
  const day = String(parseInt(dayNum, 10)).padStart(2, '0')
  const monthIdx = parseInt(monthNum, 10) - 1
  const monthLower = MONTHS[monthIdx] || 'aug'
  const monthCap = monthLower.charAt(0).toUpperCase() + monthLower.slice(1)

  // List of possible URL slugs on Naidunia Next.js routing
  const candidateUrls = [
    `https://epaper.naidunia.com/${day}-${monthLower}-${year}-${eid}-${cityName}-edition-${cityName}-page-2.html`,
    `https://epaper.naidunia.com/${day}-${monthLower}-${year}-${eid}-${cityName}-edition-${cityName}-page-1.html`,
    `https://epaper.naidunia.com/${day}-${monthCap}-${year}-${eid}-${cityName}-edition-${cityName}-page-2.html`,
    `https://epaper.naidunia.com/${day}-${monthCap}-${year}-${eid}-${cityName}-edition-${cityName}-page-1.html`
  ]

  let pageData = null
  let lastError = null

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  }

  // Auto-try candidate URLs until one succeeds
  for (const targetUrl of candidateUrls) {
    try {
      const response = await fetch(targetUrl, {
        headers: browserHeaders,
        redirect: 'follow',
        cf: { cacheTtl: 3600, cacheEverything: true }
      })

      if (response.ok) {
        const html = await response.text()
        
        // Robust Substring JSON Extractor
        const scriptMarker = 'id="__NEXT_DATA__"'
        const markerIdx = html.indexOf(scriptMarker)

        if (markerIdx !== -1) {
          const openTagEnd = html.indexOf('>', markerIdx)
          const closeTagStart = html.indexOf('</script>', openTagEnd)

          if (openTagEnd !== -1 && closeTagStart !== -1) {
            const jsonText = html.substring(openTagEnd + 1, closeTagStart).trim()
            const parsed = JSON.parse(jsonText)
            const pages = parsed?.props?.pageProps?.data || parsed?.pageProps?.data || []

            if (pages.length > 0) {
              pageData = pages
              break
            }
          }
        }
      }
    } catch (e) {
      lastError = e.message
    }
  }

  if (!pageData || pageData.length === 0) {
    return new Response(JSON.stringify({
      success: false,
      message: `${day}-${monthCap}-${year} (${cityName}) ka e-paper load nahi hua.`,
      error: lastError || 'Page data empty or not found on Naidunia'
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Sanitize Pages
  const sanitizedPages = pageData.map(page => ({
    pageno: page.pageno,
    page_image: page.page_image,
    page_largeimage: page.page_largeimage,
    page_pdf: page.page_pdf,
    formattedCity: page.formattedCity || cityName,
    formattedDate: page.formattedDate || `${day} ${monthCap} ${year}`
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
}
