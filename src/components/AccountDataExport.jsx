import { useState } from 'react'
import { Link } from 'react-router-dom'
import { exportCurrentAccountData } from '../lib/accountExport'

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" />
    </svg>
  )
}

export default function AccountDataExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', message: '' })

  async function handleExport() {
    if (isExporting) return

    setIsExporting(true)
    setFeedback({ type: '', message: '' })

    try {
      await exportCurrentAccountData()
      setFeedback({
        type: 'success',
        message: 'Đã tải bản sao JSON xuống thiết bị. Tệp có thể chứa thông tin riêng tư, hãy giữ ở nơi an toàn.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'Chưa thể chuẩn bị bản sao dữ liệu.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="account-data-export" aria-labelledby="account-data-export-title">
      <div className="account-data-export-copy">
        <span className="account-data-export-icon"><DownloadIcon /></span>
        <div>
          <p>QUYỀN DỮ LIỆU</p>
          <h2 id="account-data-export-title">Tải bản sao dữ liệu của cậu</h2>
          <span>
            Nhận một tệp JSON gồm hồ sơ, kết nối, tin nhắn, Coco Plan và các thiết lập riêng tư mà tài khoản hiện được phép xem.
          </span>
          <Link to="/trust#privacy">Xem cách Coco dùng dữ liệu</Link>
        </div>
      </div>

      <div className="account-data-export-action">
        <button type="button" onClick={handleExport} disabled={isExporting}>
          <DownloadIcon />
          {isExporting ? 'Đang chuẩn bị…' : 'Tải bản sao JSON'}
        </button>
        {feedback.message && (
          <p
            className={feedback.type === 'error' ? 'is-error' : 'is-success'}
            role={feedback.type === 'error' ? 'alert' : 'status'}
            aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </section>
  )
}
