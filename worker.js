addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CITY_SLUG_MAP = {
  '62': 'narsingpur',
  '59': 'jabalpur',
  '40': 'chhindwara',
  '20': 'mandla',
  '60': 'balaghat',
  '61': 'shahadol',
  '63': 'katni',
  '64': 'satna',
  '65': 'damoh',
  '75': 'seoni',
  '33': 'bhopal',
  '102': 'bhopalaaspass',
  '37': 'hoshangabad',
  '38': 'harda',
  '39': 'sehore',
  '41': 'betul',
  '42': 'sagar',
  '95': 'rajgarh',
  '100': 'guna',
  '101': 'raisen',
  '74': 'indore',
  '4': 'ujjain',
  '5': 'mhow',
  '6': 'ratlam',
  '7': 'khargoan',
  '8': 'khandwa',
  '9': 'shajapur',
  '10': 'mandsaur',
  '11': 'dhar',
  '12': 'dewas',
  '13': 'jhabua',
  '52': 'gwalior',
  '54': 'bundelkhand',
  '55': 'madhyanchal',
  '56': 'chamble-bind',
  '57': 'chambal',
  '97': 'dabra',
  '50': 'raipur',
  '43': 'jagdalpur',
  '44': 'dhamtari',
  '45': 'mahasamund',
  '46': 'baloudabazar',
  '47': 'rajnandgoan',
  '49': 'bhilai',
  '51': 'kanker',
  '98': 'balod',
  '99': 'bemetara-kawardha',
  '71': 'bilaspur',
  '68': 'sarguja',
  '69': 'korba',
  '70': 'janjgir',
  '72': 'raigarh'
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

  try {
    const url = new URL(request.url)

    // IST Today's Date Calculation (UTC + 5:30)
    const nowIST = new Date(Date.now() + (5.5 * 60 * 60 * 1000))
    const todayIST = nowIST.toISOString().split('T')[0]

    let dateParam = url.searchParams.get('date') || todayIST
    const eid = url.searchParams.get('eid') || '62'
    const cityName = CITY_SLUG_MAP[eid] || 'narsingpur'

    // Date Breakdown
    const [year, monthNum, dayNum] = dateParam.split('-')
    const day = String(parseInt(dayNum, 10)).padStart(2, '0')
    const monthIdx = parseInt(monthNum, 10) - 1
    const monthLower = MONTHS_LOWER[monthIdx] || 'aug'
    const monthCap = monthLower.charAt(0).toUpperCase() + monthLower.slice(1)

    // All possible URLs that Naidunia generates for Today & Archives
    const candidateUrls = [
      `https://epaper.naidunia.com/${day}-${monthLower}-${year}-${eid}-${cityName}-edition-${cityName}-page-2.html`,
      `https://epaper.naidunia.com/${day}-${monthLower}-${year}-${eid}-${cityName}-edition-${cityName}-page-1.html`,
      `https://epaper.naidunia.com/edition-today-${cityName}-${eid}.html`,
      `https://epaper.naidunia.com/${day}-${monthCap}-${year}-${eid}-${cityName}-edition-${cityName}-page-2.html`,
      `https://epaper.naidunia.com/${day}-${monthCap}-${year}-${eid}-${cityName}-edition-${cityName}-page-1.html`
    ]

    let pageData = null
    let detectedCity = cityName
    let formattedDateStr = `${day} ${monthCap} ${year}`

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      'Referer': 'https://epaper.naidunia.com/'
    }

    // Try candidate URLs
    for (const targetUrl of candidateUrls) {
      try {
        const response = await fetch(targetUrl, {
          headers: browserHeaders,
          redirect: 'follow',
          cf: { cacheTtl: 900, cacheEverything: true }
        })

        if (response.ok) {
          const html = await response.text()
          const marker = '__NEXT_DATA__'
          const markerIdx = html.indexOf(marker)

          if (markerIdx !== -1) {
            const scriptStart = html.lastIndexOf('<script', markerIdx)
            const contentStart = html.indexOf('>', scriptStart) + 1
            const contentEnd = html.indexOf('</script>', contentStart)

            if (contentStart > 0 && contentEnd > contentStart) {
              const rawJson = html.substring(contentStart, contentEnd).trim()
              const parsed = JSON.parse(rawJson)
              const rawPages = parsed?.props?.pageProps?.data || parsed?.pageProps?.data || []

              if (rawPages.length > 0) {
                pageData = rawPages
                detectedCity = rawPages[0].formattedCity || cityName
                formattedDateStr = rawPages[0].formattedDate || formattedDateStr
                break
              }
            }
          }
        }
      } catch (err) {
        // Continue fallback loop
      }
    }

    if (!pageData || pageData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: `${formattedDateStr} (${cityName}) ka e-paper uplabdh nahi hai.`,
        pages: []
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Sanitize response
    const sanitizedPages = pageData.map(page => ({
      pageno: page.pageno,
      page_image: page.page_image,
      page_largeimage: page.page_largeimage,
      page_pdf: page.page_pdf,
      formattedCity: page.formattedCity || detectedCity,
      formattedDate: page.formattedDate || formattedDateStr
    }))

    const finalResponse = {
      success: true,
      meta: {
        eid: eid,
        city: detectedCity,
        date: dateParam,
        formattedDate: formattedDateStr,
        total_pages: sanitizedPages.length
      },
      pages: sanitizedPages
    }

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900'
      }
    })

  } catch (globalError) {
    return new Response(JSON.stringify({
      success: false,
      error: globalError.message,
      message: 'Worker execution error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
