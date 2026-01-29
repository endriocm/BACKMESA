const isBrowser = typeof window !== 'undefined'

const isDebugEnabled = () => {
  if (!isBrowser) return false
  if (!import.meta?.env?.DEV) return false
  try {
    return window.localStorage.getItem('pwr.debug') === '1'
  } catch {
    return false
  }
}

export const debugLog = (event, payload = null) => {
  if (!isDebugEnabled()) return
  if (payload == null) {
    console.info(`[pwr:${event}]`)
    return
  }
  console.info(`[pwr:${event}]`, payload)
}

export const debugEnabled = () => isDebugEnabled()
