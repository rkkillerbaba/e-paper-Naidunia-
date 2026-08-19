addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// City Map for Edition IDs
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

  // 1. Extract Date and EID
  let dateParam = url.searchParams.get('date') // Expects YYYY-MM-DD
  const eid = url.searchParams.get('eid') || '62'
  const cityName = CITY_MAP[eid] || 'narsingpur'

  if (!dateParam) {
    const today = new Date()
    dateParam = today.toISOString().split('T')[0]
  }

  // 2. Parse Date components
  const [year, monthNum, dayNum] = dateParam.split('-')
  const day = String(parseInt(dayNum, 10)).padStart(2, '0')
  const monthName = MONTHS[parseInt(monthNum, 10) - 1] || 'Aug'

  // 3. Construct Next.js Page URL (e.g. 18-Aug-2026-62-narsingpur-edition-narsingpur-page-1.html)
  const targetPageUrl = `https://epaper.naidunia.com/${day}-${monthName}-${year}-${eid}-${cityName}-edition-${cityName}-page-1.html`

  try {
    const pageResponse = await fetch(targetPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      cf: {
        cacheTtl: 86400,
        cacheEverything: true
      }
    })

    if (!pageResponse.ok) {
      throw new Error(`Page not found on Naidunia (Status: ${pageResponse.status})`)
    }

    const html = await pageResponse.text()

    // 4. Extract __NEXT_DATA__ JSON from HTML
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!nextDataMatch) {
      throw new Error('E-paper JSON data script tag nahi mila.')
    }

    const nextData = JSON.parse(nextDataMatch[1])
    const rawPages = nextData?.props?.pageProps?.data || []

    if (rawPages.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: `${day} ${monthName} ${year} ka e-paper available nahi hai.`,
        pages: []
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Structure clean response
    const sanitizedPages = rawPages.map(page => ({
      pageno: page.pageno,
      page_image: page.page_image,
      page_largeimage: page.page_largeimage,
      page_pdf: page.page_pdf,
      formattedCity: page.formattedCity || cityName,
      formattedDate: page.formattedDate || `${day} ${monthName} ${year}`
    }))

    const structuredResponse = {
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

    return new Response(JSON.stringify(structuredResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Data load nahi ho paya.',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
