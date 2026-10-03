import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSupabaseConfiguration } from '../src/lib/supabaseConfig.js'

test('accepts a complete http Supabase configuration', () => {
  const configuration = resolveSupabaseConfiguration({
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  })

  assert.equal(configuration.isConfigured, true)
  assert.equal(configuration.url, 'https://project.supabase.co')
  assert.equal(configuration.publishableKey, 'sb_publishable_test')
})

test('uses inert local values when required configuration is absent', () => {
  const configuration = resolveSupabaseConfiguration({})

  assert.equal(configuration.isConfigured, false)
  assert.match(configuration.url, /^http:\/\/127\.0\.0\.1/)
  assert.ok(configuration.publishableKey)
})

test('rejects example placeholders and non-http URLs', () => {
  assert.equal(resolveSupabaseConfiguration({
    VITE_SUPABASE_URL: 'your_supabase_project_url',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'your_supabase_publishable_key',
  }).isConfigured, false)

  assert.equal(resolveSupabaseConfiguration({
    VITE_SUPABASE_URL: 'javascript:alert(1)',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  }).isConfigured, false)
})
