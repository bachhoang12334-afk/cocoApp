const fallbackUrl = 'http://127.0.0.1:54321'
const fallbackKey = 'cocoapp-configuration-required'

function isPlaceholder(value) {
  return /^(your_|replace_|example|changeme)/i.test(value)
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function resolveSupabaseConfiguration(environment = {}) {
  const url = environment.VITE_SUPABASE_URL?.trim() || ''
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || ''
  const isConfigured = (
    isValidHttpUrl(url)
    && !isPlaceholder(url)
    && Boolean(publishableKey)
    && !isPlaceholder(publishableKey)
  )

  return {
    isConfigured,
    url: isConfigured ? url : fallbackUrl,
    publishableKey: isConfigured ? publishableKey : fallbackKey,
  }
}
