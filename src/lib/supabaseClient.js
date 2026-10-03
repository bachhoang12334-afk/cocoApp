import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseConfiguration } from './supabaseConfig'

export const supabaseConfiguration = resolveSupabaseConfiguration(import.meta.env)

export const supabase = createClient(
  supabaseConfiguration.url,
  supabaseConfiguration.publishableKey
)
