import { expect } from '@playwright/test'

export function syntheticUser(prefix = 'qa') {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    fullName: `Sinh viên QA ${unique.slice(-6)}`,
    email: `${prefix}.${unique}@example.test`,
    university: 'Đại học Kiểm thử Coco',
    password: 'CocoQA!2026',
  }
}

export function trackRuntimeIssues(page) {
  const issues = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
  }

  page.on('pageerror', (error) => issues.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') issues.consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText || 'unknown failure'
    if (!reason.includes('ERR_ABORTED')) {
      issues.failedRequests.push(`${request.method()} ${request.url()} — ${reason}`)
    }
  })

  return issues
}

export function expectNoRuntimeIssues(issues) {
  expect.soft(issues.pageErrors, 'uncaught page errors').toEqual([])
  expect.soft(issues.consoleErrors, 'console errors').toEqual([])
  expect.soft(issues.failedRequests, 'failed application requests').toEqual([])
}

export async function register(page, user = syntheticUser()) {
  await page.goto('/register')
  await page.getByLabel('Họ và tên', { exact: true }).fill(user.fullName)
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Trường đại học', { exact: true }).fill(user.university)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password)
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(user.password)
  await page.getByLabel(/Tôi hiểu tài khoản/).check()
  await page.getByRole('button', { name: /Đăng ký tài khoản/ }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('status')).toContainText('Đăng ký thành công')
  return user
}

export async function login(page, user) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function registerAndLogin(page, prefix = 'qa') {
  const user = await register(page, syntheticUser(prefix))
  await login(page, user)
  return user
}

export async function fillCompleteProfile(page, overrides = {}) {
  const profile = {
    fullName: 'Sinh viên QA Coco',
    university: 'Đại học Kiểm thử Coco',
    major: 'Kỹ thuật phần mềm',
    studyYear: 'Năm 3',
    bio: 'Hồ sơ tổng hợp dùng riêng cho kiểm thử tự động CocoApp.',
    gender: 'Nam',
    purpose: 'Học nhóm',
    city: 'Hà Nội',
    area: 'Cầu Giấy',
    publicLocation: 'Gần khuôn viên trường',
    maxDistance: '10',
    ...overrides,
  }

  await page.goto('/profile')
  await page.getByLabel(/^Họ và tên/).fill(profile.fullName)
  await page.getByLabel(/^Trường đại học/).fill(profile.university)
  await page.getByLabel(/^Ngành học/).fill(profile.major)
  await page.getByLabel(/^Năm học/).selectOption(profile.studyYear)
  await page.getByLabel(/^Giới thiệu ngắn/).fill(profile.bio)
  await page.getByLabel(/^Giới tính/).selectOption(profile.gender)
  await page.getByLabel(/^Mục tiêu hiện tại/).selectOption(profile.purpose)
  await page.getByLabel(/^Tỉnh \/ Thành phố/).fill(profile.city)
  await page.getByLabel(/^Khu vực trong tỉnh/).fill(profile.area)
  await page.getByLabel(/^Tên đường hoặc địa danh/).fill(profile.publicLocation)
  await page.getByLabel(/^Khoảng cách mong muốn/).selectOption(profile.maxDistance)
  await page.getByRole('button', { name: /Lưu hồ sơ|Đã lưu thay đổi/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu trên trình duyệt này' })).toBeVisible()
  return profile
}

export async function seedConnections(page, connections) {
  await page.evaluate((items) => {
    const accountId = sessionStorage.getItem('cocoapp.session.v2')
    if (!accountId) throw new Error('Synthetic test session is missing')
    localStorage.setItem(
      `cocoapp.user.${accountId}.cocoapp.connections.v1`,
      JSON.stringify(items),
    )
  }, connections)
}

export function pendingConnection(id, name, purpose = 'Học nhóm') {
  return {
    id,
    name,
    major: 'Kỹ thuật phần mềm',
    purpose,
    city: 'Hà Nội',
    area: 'Cầu Giấy',
    location: 'Gần khuôn viên kiểm thử',
    status: 'pending',
    messages: [],
  }
}

