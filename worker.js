addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // 1. CORS Headers
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

  // 2. Query Parameters (Default: Narsingpur & Today's Date)
  let dateParam = url.searchParams.get('date')
  const eid = url.searchParams.get('eid') || '62' // 62 = Narsingpur

  if (!dateParam) {
    const today = new Date()
    dateParam = today.toISOString().split('T')[0]
  }

  // 3. Date Formatting (YYYY-MM-DD -> DDMMYYYY)
  let day, month, year
  if (dateParam.includes('-')) {
    const parts = dateParam.split('-')
    year = parts[0]
    month = parts[1].padStart(2, '0')
    day = parts[2].padStart(2, '0')
  } else if (dateParam.length === 8) {
    day = dateParam.substring(0, 2)
    month = dateParam.substring(2, 4)
    year = dateParam.substring(4, 8)
  } else {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid Date Format. Please use YYYY-MM-DD.' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const formattedDateForAPI = `${day}${month}${year}` // e.g. 19082026
  const standardDateStr = `${year}-${month}-${day}`

  // 4. Fetch from Target API
  const targetApiUrl = `https://epaper.naidunia.com/api/editiondata?eid=${eid}&date=${formattedDateForAPI}`

  try {
    const apiResponse = await fetch(targetApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://epaper.naidunia.com/',
        'Accept': 'application/json, text/plain, */*'
      },
      cf: {
        cacheTtl: 86400,
        cacheEverything: true
      }
    })

    if (!apiResponse.ok) {
      throw new Error(`Upstream API responded with status ${apiResponse.status}`)
    }

    const rawData = await apiResponse.json()
    const rawPages = rawData?.pageProps?.data || []

    if (rawPages.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Is date ka paper uplabdh nahi hai.',
        date: standardDateStr,
        eid: eid,
        pages: []
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Clean & Lightweight Data Structure
    const sanitizedPages = rawPages.map(page => ({
      pageno: page.pageno,
      page_image: page.page_image,
      page_largeimage: page.page_largeimage,
      page_pdf: page.page_pdf,
      formattedCity: page.formattedCity || 'Narsingpur',
      formattedDate: page.formattedDate || `${day} Aug ${year}`
    }))

    const structuredResponse = {
      success: true,
      meta: {
        eid: eid,
        city: sanitizedPages[0]?.formattedCity || 'Narsingpur',
        date: standardDateStr,
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
      error: 'E-paper data fetch karne me dikkat aayi.',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
