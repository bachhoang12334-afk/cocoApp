export function shouldBlockProfileNavigation({
  isDirty,
  discardConfirmed = false,
  currentPathname,
  nextPathname,
}) {
  if (!isDirty || discardConfirmed) return false

  const currentPath = typeof currentPathname === 'string' ? currentPathname : ''
  const nextPath = typeof nextPathname === 'string' ? nextPathname : ''

  return currentPath !== nextPath
}
