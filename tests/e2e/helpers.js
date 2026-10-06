import process from 'node:process'
import { expect } from '@playwright/test'

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

export async function loginWithConfiguredAccount(page) {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD are required for authenticated browser QA.')
  }

  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 })
}
