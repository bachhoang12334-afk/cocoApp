import { supabase } from './supabaseClient'
import {
  createAccountExportFilename,
  createAccountExportPayload,
  getAccountExportErrorMessage,
  serializeAccountExport,
} from './accountExportRules'

const exportQueries = [
  {
    key: 'profile',
    run: () => supabase
      .from('profiles')
      .select('id, full_name, university, major, study_year, gender, purpose, bio, city, area, public_location, proximity_scope, availability_slots, collaboration_style, commitment_level, accepting_connections, email_confirmed, education_email, verification_status, created_at, updated_at')
      .maybeSingle(),
  },
  {
    key: 'privateProfile',
    run: () => supabase
      .from('profile_private')
      .select('profile_id, phone, exact_address, hide_phone, hide_exact_address, created_at, updated_at')
      .maybeSingle(),
  },
  {
    key: 'connections',
    run: () => supabase
      .from('connection_requests')
      .select('id, requester_id, recipient_id, purpose, status, intro_message, created_at, updated_at, responded_at')
      .order('created_at', { ascending: true }),
  },
  {
    key: 'messages',
    run: () => supabase
      .from('messages')
      .select('id, connection_request_id, sender_id, body, created_at, read_at')
      .order('created_at', { ascending: true }),
  },
  {
    key: 'plans',
    run: () => supabase
      .from('connection_plans')
      .select('id, connection_request_id, proposer_id, title, starts_at, mode, location_note, status, created_at, updated_at, responded_at, completed_at, cancelled_at')
      .order('created_at', { ascending: true }),
  },
  {
    key: 'notifications',
    run: () => supabase
      .from('notifications')
      .select('id, recipient_id, actor_id, connection_request_id, connection_plan_id, type, read_at, created_at')
      .order('created_at', { ascending: true }),
  },
  {
    key: 'savedProfiles',
    run: () => supabase
      .from('saved_profiles')
      .select('owner_id, saved_profile_id, created_at')
      .order('created_at', { ascending: true }),
  },
  {
    key: 'blockedProfiles',
    run: () => supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id, created_at')
      .order('created_at', { ascending: true }),
  },
  {
    key: 'safetyReports',
    run: () => supabase
      .from('user_reports')
      .select('id, reporter_id, reported_user_id, connection_request_id, message_id, category, details, status, created_at, updated_at')
      .order('created_at', { ascending: true }),
  },
]

export async function prepareCurrentAccountExport({ exportedAt = new Date() } = {}) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    throw new Error(userError?.message || 'account_export_session_missing')
  }

  const results = await Promise.all(exportQueries.map(async ({ key, run }) => {
    const result = await run()

    if (result.error) {
      throw new Error(`account_export_query_failed:${key}:${result.error.message}`)
    }

    return [key, result.data]
  }))

  return createAccountExportPayload({
    exportedAt,
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at,
      lastSignInAt: user.last_sign_in_at,
    },
    data: Object.fromEntries(results),
  })
}

export function downloadAccountExport(payload, { documentRef = document, urlApi = URL } = {}) {
  const exportedAt = new Date(payload.exportedAt)
  const blob = new Blob([serializeAccountExport(payload)], { type: 'application/json;charset=utf-8' })
  const objectUrl = urlApi.createObjectURL(blob)
  const link = documentRef.createElement('a')

  link.href = objectUrl
  link.download = createAccountExportFilename(exportedAt)
  link.hidden = true
  documentRef.body.append(link)
  link.click()
  link.remove()
  urlApi.revokeObjectURL(objectUrl)
}

export async function exportCurrentAccountData() {
  try {
    const payload = await prepareCurrentAccountExport()
    downloadAccountExport(payload)
    return payload
  } catch (error) {
    throw new Error(getAccountExportErrorMessage(error), { cause: error })
  }
}
