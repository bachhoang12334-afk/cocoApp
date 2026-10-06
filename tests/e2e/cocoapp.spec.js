import { expect, test } from '@playwright/test'
import {
  expectNoRuntimeIssues,
  fillCompleteProfile,
  pendingConnection,
  registerAndLogin,
  seedConnections,
  syntheticUser,
  trackRuntimeIssues,
} from './helpers.js'

test.describe('CocoApp end-to-end QA', () => {
  test('authentication, validation, route protection, and session persistence', async ({ page }) => {
    const issues = trackRuntimeIssues(page)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.locator('#login-email-error')).toBeVisible()
    await expect(page.locator('#login-password-error')).toBeVisible()

    await page.getByRole('link', { name: 'Đăng ký tài khoản' }).click()
    const user = syntheticUser('auth')
    await page.getByLabel('Họ và tên', { exact: true }).fill(user.fullName)
    await page.getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByLabel('Trường đại học', { exact: true }).fill(user.university)
    await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password)
    await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('KhongTrung!2026')
    await page.getByLabel(/Tôi hiểu tài khoản/).check()
    await page.getByRole('button', { name: /Đăng ký tài khoản/ }).click()
    await expect(page.getByText('Hai ô mật khẩu chưa giống nhau.').first()).toBeVisible()

    await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(user.password)
    await page.getByLabel(/Tôi hiểu tài khoản/).uncheck()
    await page.getByRole('button', { name: /Đăng ký tài khoản/ }).click()
    await expect(page.getByText('Hãy xác nhận thông tin lưu trữ trên trình duyệt.').first()).toBeVisible()

    await page.getByLabel(/Tôi hiểu tài khoản/).check()
    await page.getByRole('button', { name: /Đăng ký tài khoản/ }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('status')).toContainText('Đăng ký thành công')

    await page.getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByLabel('Mật khẩu', { exact: true }).fill('SaiMatKhau!')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu chưa đúng')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Mật khẩu', { exact: true }).fill(user.password)
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click()
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click()
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.reload()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')

    await page.getByRole('link', { name: 'Đăng xuất' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expectNoRuntimeIssues(issues)
  })

  test('dashboard actions, summary cards, desktop and mobile navigation', async ({ page }) => {
    const issues = trackRuntimeIssues(page)
    await registerAndLogin(page, 'navigation')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào')
    await page.getByRole('link', { name: /Tìm bạn học/ }).click()
    await expect(page).toHaveURL(/\/study$/)
    await page.getByRole('link', { name: 'Tổng quan' }).click()

    await page.getByRole('link', { name: /Tìm team project/ }).click()
    await expect(page).toHaveURL(/\/team$/)
    await page.getByRole('link', { name: 'Tổng quan' }).click()

    await page.getByRole('link', { name: /Tìm bạn ghép trọ/ }).click()
    await expect(page).toHaveURL(/\/roommates$/)
    await page.getByRole('link', { name: 'Tổng quan' }).click()

    await page.getByRole('link', { name: /Mở kết nối, 0 lời mời đang chờ/ }).click()
    await expect(page).toHaveURL(/\/matches$/)

    await page.getByRole('link', { name: 'Tổng quan' }).click()
    await page.getByRole('link', { name: /Mở kết nối, 0 kết nối đã chấp nhận/ }).click()
    await expect(page).toHaveURL(/\/matches$/)

    await page.getByRole('link', { name: /Xem hồ sơ/ }).click()
    await expect(page).toHaveURL(/\/profile$/)

    await page.setViewportSize({ width: 375, height: 812 })
    const mobileNavigation = page.getByRole('navigation', { name: 'Điều hướng điện thoại' })
    await expect(mobileNavigation).toBeVisible()
    await mobileNavigation.getByRole('link', { name: 'Khám phá' }).click()
    await expect(page).toHaveURL(/\/discover$/)
    await mobileNavigation.getByRole('link', { name: 'Kết nối' }).click()
    await expect(page).toHaveURL(/\/matches$/)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('link', { name: 'Đăng xuất' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expectNoRuntimeIssues(issues)
  })

  test('Discover filters, privacy, dialog behavior, skip and undo', async ({ page }) => {
    const issues = trackRuntimeIssues(page)
    await registerAndLogin(page, 'discover')
    await fillCompleteProfile(page, { gender: 'Nam', city: 'Hà Nội', area: 'Cầu Giấy' })
    await page.goto('/discover')

    const filters = page.locator('#discover-filters')
    const city = filters.getByLabel('Tỉnh / Thành phố')
    expect((await city.locator('option').allTextContents()).slice(1)).toHaveLength(34)

    const search = filters.getByLabel('Tên, ngành, kỹ năng hoặc địa điểm')
    await search.fill('React')
    await expect(page.locator('.discover-student-card')).toHaveCount(1)
    await expect(page.locator('.discover-student-card')).toContainText('Trần Quang Huy')
    await filters.getByRole('button', { name: 'Đặt lại' }).click()

    await page.getByRole('button', { name: 'Team Project' }).click()
    await expect(page.locator('.discover-student-card')).toHaveCount(2)
    await expect(page.getByText('Trần Quang Huy')).toBeVisible()
    await expect(page.getByText('Nguyễn Gia Bảo')).toBeVisible()
    await page.getByRole('button', { name: 'Tất cả' }).click()

    await city.selectOption('Đà Nẵng')
    await expect(filters.getByLabel('Khu vực').locator('option')).toHaveCount(2)
    await filters.getByLabel('Khu vực').selectOption('Hải Châu')
    await filters.getByLabel('Khoảng cách tối đa — số liệu mẫu').selectOption('1')
    await expect(page.getByRole('heading', { name: 'Chưa có kết quả phù hợp' })).toBeVisible()
    await filters.getByLabel('Khoảng cách tối đa — số liệu mẫu').selectOption('10')
    await expect(page.locator('.discover-student-card')).toContainText('Nguyễn Gia Bảo')

    await city.selectOption('An Giang')
    await expect(page.getByRole('heading', { name: 'Chưa có kết quả phù hợp' })).toBeVisible()
    await page.locator('.discover-empty-state').getByRole('button', { name: 'Đặt lại bộ lọc' }).click()
    await expect(page.locator('.discover-student-card').first()).toBeVisible()

    await page.getByRole('button', { name: 'Ghép trọ' }).click()
    await expect(page.locator('.discover-student-card')).toHaveCount(2)
    await expect(page.getByText('Lê Đức Long')).toBeVisible()
    await expect(page.getByText('Vũ Minh Khang')).toBeVisible()
    await expect(page.getByText('Phạm Thu Trang')).toHaveCount(0)
    await expect(page.getByText('Đỗ Ngọc Mai')).toHaveCount(0)
    await page.getByRole('button', { name: 'Tất cả' }).click()

    const trigger = page.getByRole('button', { name: 'Xem hồ sơ' }).first()
    const scrollBefore = await page.evaluate(() => window.scrollY)
    await trigger.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
    await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click()
    await expect(trigger).toBeFocused()

    await trigger.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()

    await trigger.click()
    await page.locator('.discover-dialog-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const beforeSkipCount = await page.locator('.discover-student-card').count()
    await trigger.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Bỏ qua hồ sơ' }).click()
    await expect(page.getByRole('status')).toContainText('Đã ẩn hồ sơ')
    await expect(page.locator('.discover-student-card')).toHaveCount(beforeSkipCount - 1)
    await page.getByRole('button', { name: 'Hoàn tác' }).click()
    await expect(page.locator('.discover-student-card')).toHaveCount(beforeSkipCount)
    expectNoRuntimeIssues(issues)
  })

  test('Matches tabs, confirmation, multiple conversations, persistence and mobile chat', async ({ page }) => {
    const issues = trackRuntimeIssues(page)
    await registerAndLogin(page, 'matches')
    const first = pendingConnection(9001, 'Bạn Kiểm thử Một', 'Học nhóm')
    const second = pendingConnection(9002, 'Bạn Kiểm thử Hai', 'Team Project')
    const third = pendingConnection(9003, 'Bạn Kiểm thử Ba', 'Ghép trọ')
    await seedConnections(page, [first, second, third])
    await page.goto('/matches')

    await expect(page.getByRole('tab', { name: 'Đang chờ (3)' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Đã kết nối (0)' })).toBeVisible()

    const cancelCard = page.locator('article').filter({ hasText: third.name })
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(third.name)
      await dialog.accept()
    })
    await cancelCard.getByRole('button', { name: 'Hủy lời mời' }).click()
    await expect(page.getByRole('tab', { name: 'Đang chờ (2)' })).toBeVisible()

    await page.locator('article').filter({ hasText: first.name }).getByRole('button', { name: /Chấp nhận/ }).click()
    await expect(page.getByRole('tab', { name: 'Đã kết nối (1)' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: 'Đang chờ (1)' }).click()
    await page.locator('article').filter({ hasText: second.name }).getByRole('button', { name: /Chấp nhận/ }).click()
    await expect(page.getByRole('tab', { name: 'Đã kết nối (2)' })).toHaveAttribute('aria-selected', 'true')

    const conversationOne = page.getByRole('button', { name: new RegExp(first.name) })
    const conversationTwo = page.getByRole('button', { name: new RegExp(second.name) })
    await conversationOne.click()
    const firstMessage = `Tin riêng một ${Date.now()}`
    await page.getByRole('textbox', { name: 'Tin nhắn' }).fill(firstMessage)
    await page.getByRole('button', { name: 'Gửi tin nhắn' }).click()

    const scrollBeforeSwitch = await page.evaluate(() => window.scrollY)
    await conversationTwo.click()
    expect.soft(
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeSwitch),
      'switching conversations must not scroll the document',
    ).toBeLessThanOrEqual(2)
    const secondMessage = `Tin riêng hai ${Date.now()}`
    await page.getByRole('textbox', { name: 'Tin nhắn' }).fill(secondMessage)
    await page.getByRole('button', { name: 'Gửi tin nhắn' }).click()

    await conversationOne.click()
    const messageLog = page.getByRole('log')
    await expect(messageLog.getByText(firstMessage)).toBeVisible()
    await expect(messageLog.getByText(secondMessage)).toHaveCount(0)
    await page.getByRole('button', { name: 'Mô phỏng phản hồi' }).click()

    const sentBox = await messageLog.locator('.from-me').last().boundingBox()
    const receivedBox = await messageLog.locator('.from-other').last().boundingBox()
    expect(sentBox).not.toBeNull()
    expect(receivedBox).not.toBeNull()
    expect(sentBox.x).toBeGreaterThan(receivedBox.x)

    await page.reload()
    await page.getByRole('tab', { name: 'Đã kết nối (2)' }).click()
    await page.getByRole('button', { name: new RegExp(first.name) }).click()
    await expect(page.getByRole('log').getByText(firstMessage)).toBeVisible()

    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByRole('button', { name: 'Quay lại' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Tin nhắn' }).scrollIntoViewIfNeeded()
    const overlap = await page.evaluate(() => {
      const composer = document.querySelector('.chat-composer')?.getBoundingClientRect()
      const navigation = document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect()
      if (!composer || !navigation) return null
      return Math.max(0, Math.min(composer.bottom, navigation.bottom) - Math.max(composer.top, navigation.top))
    })
    expect(overlap, 'mobile bottom navigation must not cover the message composer').toBe(0)
    await page.getByRole('button', { name: 'Quay lại' }).click()
    await expect(page.locator('.conversation-list')).toBeVisible()
    expectNoRuntimeIssues(issues)
  })

  test('Profile validation, save feedback, completion, privacy and persistence', async ({ page }) => {
    const issues = trackRuntimeIssues(page)
    const user = await registerAndLogin(page, 'profile')
    await page.goto('/profile')

    await expect(page.getByLabel(/^Họ và tên/)).toHaveValue(user.fullName)
    await expect(page.getByLabel(/^Trường đại học/)).toHaveValue(user.university)
    await page.getByLabel(/^Họ và tên/).fill('')
    await page.getByRole('button', { name: /Lưu hồ sơ/ }).click()
    await expect(page.getByText('Họ và tên là thông tin bắt buộc.')).toBeVisible()

    await page.getByLabel(/^Họ và tên/).fill('Sinh viên Hồ sơ QA')
    await page.getByLabel(/^Ngành học/).fill('Kỹ thuật phần mềm')
    await page.getByLabel(/^Năm học/).selectOption('Năm 4')
    await page.getByLabel(/^Giới thiệu ngắn/).fill('Thông tin giả phục vụ kiểm thử hồ sơ.')
    await page.getByLabel(/^Giới tính/).selectOption('Nữ')
    await page.getByLabel(/^Mục tiêu hiện tại/).selectOption('Team Project')
    await page.getByLabel(/^Tỉnh \/ Thành phố/).fill('Hà Nội')
    await page.getByLabel(/^Khu vực trong tỉnh/).fill('Thanh Xuân')
    await page.getByLabel(/^Tên đường hoặc địa danh/).fill('Gần trường đại học')
    await page.getByLabel(/^Khoảng cách mong muốn/).selectOption('10')

    await expect(page.getByText('Cậu có thay đổi chưa được lưu.')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Mức độ hoàn thiện hồ sơ' })).toHaveAttribute('aria-valuenow', '100')
    await expect(page.getByText('Xác minh tài khoản: Chưa xác minh')).toBeVisible()
    await page.getByRole('button', { name: /Lưu hồ sơ/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Đã lưu trên trình duyệt này' })).toBeVisible()
    await expect.soft(page.getByText('Cậu có thay đổi chưa được lưu.'), 'saved profile must no longer be marked as unsaved').toHaveCount(0)

    const storedPrivacy = await page.evaluate(() => {
      const accountId = sessionStorage.getItem('cocoapp.session.v2')
      const raw = localStorage.getItem(`cocoapp.user.${accountId}.cocoapp.profile.v1`)
      const profile = JSON.parse(raw)
      return {
        hidePhone: profile.hidePhone,
        hideExactAddress: profile.hideExactAddress,
      }
    })
    expect(storedPrivacy).toEqual({ hidePhone: true, hideExactAddress: true })

    await page.reload()
    await expect(page.getByLabel(/^Họ và tên/)).toHaveValue('Sinh viên Hồ sơ QA')
    await expect(page.getByLabel(/^Ngành học/)).toHaveValue('Kỹ thuật phần mềm')
    await expect(page.getByRole('progressbar', { name: 'Mức độ hoàn thiện hồ sơ' })).toHaveAttribute('aria-valuenow', '100')
    await expect(page.getByText('Xác minh tài khoản: Chưa xác minh')).toBeVisible()

    await page.getByLabel(/^Ngành học/).fill('Trí tuệ nhân tạo')
    await expect(page.getByText('Cậu có thay đổi chưa được lưu.')).toBeVisible()
    expectNoRuntimeIssues(issues)
  })

  test('responsive, accessibility and screenshot smoke matrix', async ({ page }) => {
    test.setTimeout(120_000)
    const issues = trackRuntimeIssues(page)
    await registerAndLogin(page, 'responsive')
    await fillCompleteProfile(page)
    await seedConnections(page, [
      { ...pendingConnection(9101, 'Hội thoại Ảnh Một'), status: 'accepted' },
      { ...pendingConnection(9102, 'Hội thoại Ảnh Hai', 'Team Project'), status: 'accepted' },
    ])

    const viewports = [375, 768, 1024, 1440]
    const screens = [
      ['login', '/login'],
      ['dashboard', '/dashboard'],
      ['discover', '/discover'],
      ['profile', '/profile'],
      ['matches', '/matches'],
    ]

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 })

      for (const [name, route] of screens) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))
        expect.soft(
          overflow.scrollWidth,
          `${name} at ${width}px has horizontal document overflow`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1)

        const outsideControls = await page.evaluate(() => [...document.querySelectorAll('a,button,input,select,textarea')]
          .filter((element) => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
          })
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || element.tagName,
              left: rect.left,
              right: rect.right,
            }
          })
          .filter((item) => item.left < -1 || item.right > window.innerWidth + 1))
        expect.soft(outsideControls, `${name} at ${width}px has controls outside the viewport`).toEqual([])

        const shortImportantControls = await page.evaluate(() => [...document.querySelectorAll('button,input,select,textarea')]
          .filter((element) => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return !element.disabled && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
          })
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || element.getAttribute('placeholder') || element.tagName,
              height: Math.round(rect.height),
            }
          })
          .filter((item) => item.height < 44))
        expect.soft(shortImportantControls, `${name} at ${width}px has important controls shorter than 44px`).toEqual([])

        await page.screenshot({
          path: `tests/e2e/screenshots/${width}-${name}.png`,
          fullPage: true,
        })

        if (name !== 'login') {
          if (width <= 760) {
            await expect(page.getByRole('navigation', { name: 'Điều hướng điện thoại' })).toBeVisible()
          } else {
            await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible()
          }

          await page.locator('body').click({ position: { x: width - 2, y: 2 } })
          await page.keyboard.press('Tab')
          const focusVisible = await page.evaluate(() => {
            const element = document.activeElement
            if (!element || element === document.body) return false
            const style = getComputedStyle(element)
            return parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none'
          })
          expect.soft(focusVisible, `${name} at ${width}px must expose a visible keyboard focus indicator`).toBe(true)

          if (width <= 760) {
            const finalContentCovered = await page.evaluate(() => {
              const main = document.querySelector('.app-content')
              const navigation = document.querySelector('.mobile-bottom-nav')
              if (!main || !navigation) return null
              const controls = [...main.querySelectorAll('a,button,input,select,textarea')]
                .filter((element) => {
                  const style = getComputedStyle(element)
                  const rect = element.getBoundingClientRect()
                  return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0
                })
              const last = controls.at(-1)
              if (!last) return false
              last.scrollIntoView({ block: 'end' })
              const lastRect = last.getBoundingClientRect()
              const navRect = navigation.getBoundingClientRect()
              return lastRect.bottom > navRect.top + 1 && lastRect.top < navRect.bottom - 1
            })
            expect.soft(finalContentCovered, `${name} at ${width}px final control is covered by fixed navigation`).toBe(false)
          }
        }
      }
    }

    expectNoRuntimeIssues(issues)
  })
})
