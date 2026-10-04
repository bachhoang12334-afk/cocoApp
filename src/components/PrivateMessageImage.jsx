import { useEffect, useState } from 'react'
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

  return (
    <a
      className="chat-message-image-link"
      href={signedUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Mở ảnh do ${senderName} chia sẻ`}
    >
      <img
        src={signedUrl}
        alt={`Ảnh do ${senderName} chia sẻ trong cuộc trò chuyện`}
        loading="lazy"
        decoding="async"
        onError={() => {
          signedUrlCache.delete(path)
          setLoadError(true)
        }}
      />
    </a>
  )
}
