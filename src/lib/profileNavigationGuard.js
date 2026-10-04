export function shouldBlockProfileNavigation({
  isDirty,
  currentPathname,
  nextPathname,
}) {
  if (!isDirty) return false

  const currentPath = typeof currentPathname === 'string' ? currentPathname : ''
  const nextPath = typeof nextPathname === 'string' ? nextPathname : ''

  return currentPath !== nextPath
}
