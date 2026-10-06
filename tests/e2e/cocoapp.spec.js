import { expect, test } from '@playwright/test'
import {
  expectNoRuntimeIssues,
  loginWithConfiguredAccount,
  trackRuntimeIssues,
} from './helpers.js'

test.describe('CocoApp end-to-end QA (Supabase aware)', () => {
  test('public auth UI, validation, and protected-route redirect', async ({ page }) => {
    const issues = trackRuntimeIssues(page)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.locator('#login-email-error')).toBeVisible()
    await expect(page.locator('#login-password-error')).toBeVisible()

    await page.getByRole('link', { name: 'Đăng ký tài khoản' }).click()
    await expect(page).toHaveURL(/\/register$/)

    await page.getByLabel('Họ và tên', { exact: true }).fill('Sinh viên QA Coco')
    await page.getByLabel('Email', { exact: true }).fill('qa@example.com')
    await page.getByLabel('Trường đại học', { exact: true }).fill('ICTU')
    await page.getByLabel('Mật khẩu', { exact: true }).fill('CocoQA!2026')
    await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('KhongTrung!2026')
    await page.getByRole('button', { name: /Đăng ký tài khoản/ }).click()

    await expect(page.getByText('Hai ô mật khẩu chưa giống nhau.').first()).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Hãy kiểm tra các thông tin')

    await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('CocoQA!2026')
    await page.getByRole('button', { name: /Đăng ký tài khoản/ }).click()
    await expect(page.getByText('Hãy đọc và đồng ý với nguyên tắc sử dụng Coco.').first()).toBeVisible()

    await page.goto('/login')
    await expect(page.getByRole('link', { name: 'Quên mật khẩu?' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Đăng ký tài khoản' })).toBeVisible()

    expectNoRuntimeIssues(issues)
  })

  test('responsive login shell and accessibility smoke test', async ({ page }) => {
    const issues = trackRuntimeIssues(page)

    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Chào mừng quay lại' })).toBeVisible()

    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByText('Gặp đúng người.')).toBeVisible()

    expectNoRuntimeIssues(issues)
  })

  test('authenticated dashboard, navigation, rooms and Study Hub smoke test', async ({ page }) => {
    test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in .env.local to run authenticated browser QA.')

    const issues = trackRuntimeIssues(page)
    await loginWithConfiguredAccount(page)

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')

    await page.goto('/discover')
    await expect(page.locator('body')).toContainText(/Khám phá|Coco Fit|Tìm/)

    await page.goto('/rooms')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tìm phòng trọ')
    await expect(page.getByText(/kết quả/).first()).toBeVisible()

    await page.goto('/study-hub')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Không chỉ tìm người')
    await expect(page.getByRole('button', { name: /Nhóm học/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tài liệu/ })).toBeVisible()

    expectNoRuntimeIssues(issues)
  })

  test('authenticated profile and matches pages render without runtime crashes', async ({ page }) => {
    test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD in .env.local to run authenticated browser QA.')

    const issues = trackRuntimeIssues(page)
    await loginWithConfiguredAccount(page)

    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/matches')
    await expect(page.locator('body')).toContainText(/Kết nối|Đã kết nối|Đang chờ/)

    expectNoRuntimeIssues(issues)
  })
})
