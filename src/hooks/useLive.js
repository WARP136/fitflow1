import { useEffect, useState } from 'react'
import { getWeather } from '../services/weather.js'
import { getQuote } from '../services/quotesApi.js'

/*
 * Module-level caches for the two read-only external calls. Weather shows on
 * three pages, the quote on two; without this, every navigation fires a fresh
 * request and the numbers flicker as you move around. Cache lives for the page
 * session, which is the right lifetime for both - nobody needs a second-by-
 * second temperature to decide whether to go for a walk.
 *
 * Both fetchers resolve to a usable offline object rather than throwing, so
 * there's no error branch here.
 */

const cache = { weather: null, quote: null }
const inflight = { weather: null, quote: null }

function useCached(key, fetcher) {
  const [data, setData] = useState(cache[key])

  useEffect(() => {
    if (cache[key]) return
    let alive = true
    inflight[key] = inflight[key] || fetcher()
    inflight[key].then((res) => {
      cache[key] = res
      inflight[key] = null
      if (alive) setData(res)
    })
    return () => {
      alive = false
    }
  }, [key, fetcher])

  return data
}

export const useWeather = () => useCached('weather', getWeather)
export const useQuote = () => useCached('quote', getQuote)

// Let the user pull a different line without a full reload.
export async function refreshQuote() {
  cache.quote = null
  inflight.quote = null
  const next = await getQuote()
  cache.quote = next
  return next
}
