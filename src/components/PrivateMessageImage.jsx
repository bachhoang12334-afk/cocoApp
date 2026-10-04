import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { MESSAGE_IMAGE_BUCKET } from '../lib/messageImages'
import { supabase } from '../lib/supabaseClient'

const signedUrlCache = new Map()
const SIGNED_URL_LIFETIME_SECONDS = 10 * 60
const CACHE_SAFETY_WINDOW_MS = 30 * 1000

async function getSignedMessageImageUrl(path, forceRefresh = false) {
  const cached = signedUrlCache.get(path)

  if (!forceRefresh && cached && cached.expiresAt > Date.now() + CACHE_SAFETY_WINDOW_MS) {
    return cached.url
  }

  const { data, error } = await supabase.storage
    .from(MESSAGE_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_LIFETIME_SECONDS)

  if (error || !data?.signedUrl) {
    signedUrlCache.delete(path)
    throw error || new Error('message_image_signed_url_missing')
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_LIFETIME_SECONDS * 1000,
  })

  return data.signedUrl
}

export default function PrivateMessageImage({ path, senderName }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const triggerRef = useRef(null)
  const viewerRef = useRef(null)
  const viewerTitleId = useId()
  const viewerDescriptionId = useId()

  useEffect(() => {
    let cancelled = false

    getSignedMessageImageUrl(path, retryCount > 0)
      .then((url) => {
        if (!cancelled) setSignedUrl(url)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true
    }
  }, [path, retryCount])

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus({ preventScroll: true })
    })
  }, [])

  useEffect(() => {
    if (!viewerOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const focusFrame = window.requestAnimationFrame(() => {
      viewerRef.current?.focus({ preventScroll: true })
    })

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeViewer()
        return
      }

      if (event.key !== 'Tab' || !viewerRef.current) return

      const focusable = [...viewerRef.current.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )]
      if (focusable.length === 0) {
        event.preventDefault()
        viewerRef.current.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && (document.activeElement === first || document.activeElement === viewerRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeViewer, viewerOpen])

  if (loadError) {
    return (
      <div className="chat-message-image-error" role="status">
        <span>Chưa tải được ảnh riêng tư.</span>
        <button
          type="button"
          onClick={() => {
            setLoadError(false)
            setSignedUrl('')
            setRetryCount((count) => count + 1)
          }}
        >
          Thử lại
        </button>
      </div>
    )
  }

  if (!signedUrl) {
    return <div className="chat-message-image-loading" role="status">Đang tải ảnh…</div>
  }

  function handleImageError() {
    signedUrlCache.delete(path)
    setViewerOpen(false)
    setLoadError(true)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="chat-message-image-button"
        aria-label={`Xem lớn ảnh do ${senderName} chia sẻ`}
        aria-haspopup="dialog"
        aria-expanded={viewerOpen}
        onClick={() => setViewerOpen(true)}
      >
        <img
          src={signedUrl}
          alt={`Ảnh do ${senderName} chia sẻ trong cuộc trò chuyện`}
          loading="lazy"
          decoding="async"
          onError={handleImageError}
        />
        <span className="chat-message-image-hint" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4M11 8v6M8 11h6" />
          </svg>
          Xem lớn
        </span>
      </button>

      {viewerOpen && (
        <div
          className="chat-image-viewer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer()
          }}
        >
          <section
            ref={viewerRef}
            className="chat-image-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={viewerTitleId}
            aria-describedby={viewerDescriptionId}
            tabIndex="-1"
          >
            <header className="chat-image-viewer-header">
              <div>
                <p>ẢNH RIÊNG TƯ</p>
                <h2 id={viewerTitleId}>Ảnh do {senderName} chia sẻ</h2>
              </div>
              <button type="button" aria-label="Đóng ảnh" onClick={closeViewer}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className="chat-image-viewer-canvas">
              <img
                src={signedUrl}
                alt={`Ảnh do ${senderName} chia sẻ trong cuộc trò chuyện`}
                onError={handleImageError}
              />
            </div>

            <p id={viewerDescriptionId} className="chat-image-viewer-note">
              Ảnh chỉ hiển thị bằng liên kết ký tạm thời dành cho người tham gia cuộc trò chuyện.
            </p>
          </section>
        </div>
      )}
    </>
  )
}
