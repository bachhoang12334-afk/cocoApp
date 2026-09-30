const connectionProfileFields = [
  'id',
  'full_name',
  'major',
  'purpose',
  'city',
  'area',
  'public_location',
  'bio',
  'email_confirmed',
  'education_email',
  'verification_status',
]

function getConnectionProfile(row) {
  if (!row?.other_profile_id) return null

  return connectionProfileFields.reduce((profile, field) => {
    const sourceField = field === 'id' ? 'other_profile_id' : `other_${field}`
    profile[field] = row[sourceField]
    return profile
  }, {})
}

export function normalizeConnectionRequest(row) {
  const otherProfile = getConnectionProfile(row)
  const otherIsRequester = row?.requester_id === row?.other_profile_id

  return {
    id: row?.id,
    requester_id: row?.requester_id,
    recipient_id: row?.recipient_id,
    purpose: row?.purpose,
    intro_message: row?.intro_message,
    status: row?.status,
    created_at: row?.created_at,
    responded_at: row?.responded_at,
    requester: otherIsRequester ? otherProfile : null,
    recipient: otherIsRequester ? null : otherProfile,
  }
}

export function normalizeConnectionRequests(rows) {
  return (rows || []).map(normalizeConnectionRequest)
}

export function normalizeNotification(row) {
  return {
    id: row?.id,
    recipient_id: row?.recipient_id,
    actor_id: row?.actor_id,
    connection_request_id: row?.connection_request_id,
    type: row?.type,
    read_at: row?.read_at,
    created_at: row?.created_at,
    actor: row?.actor_full_name
      ? { full_name: row.actor_full_name }
      : null,
  }
}

export function normalizeNotifications(rows) {
  return (rows || []).map(normalizeNotification)
}
