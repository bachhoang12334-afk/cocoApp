export function getCommunityInviteLink(origin) {
  try {
    return new URL('/register', origin).toString()
  } catch {
    return '/register'
  }
}

export function getCommunityInviteMessage(origin) {
  const inviteLink = getCommunityInviteLink(origin)

  return `Tham gia CocoApp cùng mình để tìm bạn học, team project hoặc người ghép trọ phù hợp nhé: ${inviteLink}`
}
