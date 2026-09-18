import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { supabase } from '../lib/supabaseClient'

const purposeLabels = {
  study_group: 'Học nhóm',
  team_project: 'Team Project',
  roommates: 'Ghép trọ',
}

function mapMessage(message, userId) {
  return {
    id: message.id,
    sender: message.sender_id === userId ? 'me' : 'other',
    text: message.body,
    createdAt: message.created_at,
  }
}

function mapRequest(request, userId, messagesByRequest) {
  const isIncoming = request.recipient_id === userId
  const otherProfile = isIncoming ? request.requester : request.recipient

  return {
    id: request.id,
    name: otherProfile?.full_name?.trim() || 'Sinh viên CocoApp',
    major: otherProfile?.major?.trim() || 'Chưa cập nhật ngành học',
    purpose: purposeLabels[request.purpose] || 'Kết nối',
    city: otherProfile?.city?.trim() || '',
    area: otherProfile?.area?.trim() || '',
    location: otherProfile?.public_location?.trim() || '',
    about: otherProfile?.bio?.trim() || 'Chưa có giới thiệu.',
    status: request.status,
    isIncoming,
    requesterId: request.requester_id,
    recipientId: request.recipient_id,
    messages: messagesByRequest.get(request.id) || [],
  }
}

const profileFields = 'id, full_name, major, purpose, city, area, public_location, bio'
const requestSelect = `id, requester_id, recipient_id, purpose, status, created_at, responded_at, requester:profiles!connection_requests_requester_id_fkey (${profileFields}), recipient:profiles!connection_requests_recipient_id_fkey (${profileFields})`

function getMatchesErrorMessage(error) {
  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Không thể tải hoặc cập nhật lời mời do quyền truy cập. Hãy đăng nhập lại.'
  }

  return 'Không thể tải danh sách kết nối. Hãy thử lại sau.'
}

function getMessageErrorMessage(error) {
  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Không thể gửi tin nhắn. Hãy kiểm tra kết nối vẫn đang được chấp nhận.'
  }

  return 'Chưa gửi được tin nhắn. Hãy thử lại.'
}

function mergeMessages(serverMessages, currentMessages) {
  const byId = new Map()

  for (const message of [...serverMessages, ...currentMessages]) {
    byId.set(message.id, message)
  }

  return [...byId.values()].sort((first, second) => {
    const timeDifference = new Date(first.createdAt) - new Date(second.createdAt)
    return timeDifference || first.id.localeCompare(second.id)
  })
}

function mergeConnections(serverConnections, currentConnections) {
  const currentById = new Map(currentConnections.map((item) => [item.id, item]))

  return serverConnections.map((item) => {
    const current = currentById.get(item.id)
    if (!current) return item

    return {
      ...item,
      messages: mergeMessages(item.messages, current.messages),
    }
  })
}

async function fetchConnections() {
  const user = await getCurrentAccount()
  if (!user) throw new Error('Phiên đăng nhập đã hết.')

  const { data: requests, error } = await supabase
    .from('connection_requests')
    .select(requestSelect)
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) throw error

  const acceptedRequestIds = (requests || [])
    .filter((request) => request.status === 'accepted')
    .map((request) => request.id)
  const messagesByRequest = new Map()

  if (acceptedRequestIds.length > 0) {
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, connection_request_id, sender_id, body, created_at')
      .in('connection_request_id', acceptedRequestIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (messagesError) throw messagesError

    for (const message of messages || []) {
      const requestMessages = messagesByRequest.get(message.connection_request_id) || []
      requestMessages.push(mapMessage(message, user.id))
      messagesByRequest.set(message.connection_request_id, requestMessages)
    }
  }

  return {
    userId: user.id,
    connections: (requests || []).map((request) => (
      mapRequest(request, user.id, messagesByRequest)
    )),
  }
}

export default function Matches() {
  const [connections, setConnections] = useState([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [tab, setTab] = useState('pending')
  const [chatId, setChatId] = useState(null)
  const [draft, setDraft] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const chatHeadingRef = useRef(null)
  const messageListRef = useRef(null)
  const lastChatTriggerRef = useRef(null)
  const shouldFocusChatRef = useRef(false)
  const confirmationTriggerRef = useRef(null)
  const messageUserIdRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    let messageChannel = null
    let refreshInFlight = null

    function refreshConnections() {
      if (refreshInFlight) return refreshInFlight

      refreshInFlight = fetchConnections()
        .then(({ userId, connections: nextConnections }) => {
          if (!isMounted) return

          messageUserIdRef.current = userId
          setConnections((current) => mergeConnections(nextConnections, current))
          setError('')
        })
        .finally(() => {
          refreshInFlight = null
        })

      return refreshInFlight
    }

    async function setupMessages() {
      try {
        await refreshConnections()
        if (!isMounted || !messageUserIdRef.current) return

        messageChannel = supabase
          .channel(`messages:${messageUserIdRef.current}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              if (!isMounted || !payload.new?.connection_request_id) return

              const message = mapMessage(payload.new, messageUserIdRef.current)
              setConnections((current) => current.map((item) => {
                if (item.id !== payload.new.connection_request_id) return item
                if (item.messages.some((currentMessage) => currentMessage.id === message.id)) {
                  return item
                }

                return {
                  ...item,
                  messages: mergeMessages(item.messages, [message]),
                }
              }))
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void refreshConnections().catch((loadError) => {
                if (isMounted) setError(getMatchesErrorMessage(loadError))
              })
            }
          })
      } catch (loadError) {
        if (isMounted) setError(getMatchesErrorMessage(loadError))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    function handleWindowFocus() {
      void refreshConnections().catch((loadError) => {
        if (isMounted) setError(getMatchesErrorMessage(loadError))
      })
    }

    window.addEventListener('focus', handleWindowFocus)
    void setupMessages()

    return () => {
      isMounted = false
      window.removeEventListener('focus', handleWindowFocus)
      if (messageChannel) void supabase.removeChannel(messageChannel)
    }
  }, [])

  const pendingCount = connections.filter(
    (item) => item.status === 'pending'
  ).length

  const acceptedCount = connections.filter(
    (item) => item.status === 'accepted'
  ).length

  const visibleConnections = connections.filter(
    (item) => item.status === tab
  )

  const chat = connections.find(
    (item) => item.id === chatId && item.status === 'accepted'
  )
  const chatMessageCount = chat?.messages.length ?? 0

  const acceptedConnections = connections.filter(
    (item) => item.status === 'accepted'
  )

  useEffect(() => {
    if (chat && shouldFocusChatRef.current) {
      chatHeadingRef.current?.focus({ preventScroll: true })
      shouldFocusChatRef.current = false
    }
  }, [chat, chatId])

  useEffect(() => {
    if (chatId !== null) {
      const messageList = messageListRef.current
      if (messageList) messageList.scrollTop = messageList.scrollHeight
    }
  }, [chatId, chatMessageCount])

  async function updateRequest(id, status) {
    const request = connections.find((item) => item.id === id)
    if (!request || !['pending', 'accepted'].includes(request.status) || actionId) return

    setActionId(id)
    setError('')

    try {
      const { data: updatedRequest, error: updateError } = await supabase
        .from('connection_requests')
        .update({ status })
        .eq('id', id)
        .select('id, status')
        .single()

      if (updateError) throw updateError
      if (updatedRequest.status !== status) {
        throw new Error('Connection request status was not updated')
      }

      const { userId, connections: nextConnections } = await fetchConnections()
      messageUserIdRef.current = userId
      setConnections((current) => mergeConnections(nextConnections, current))
      setStatusMessage(
        status === 'accepted'
          ? 'Đã chấp nhận lời mời kết nối.'
          : status === 'declined'
            ? 'Đã từ chối lời mời kết nối.'
            : 'Đã hủy lời mời kết nối.'
      )
      if (status === 'cancelled' && chatId === id) closeChat()
      if (status === 'accepted') setTab('accepted')
    } catch (updateError) {
      setError(getMatchesErrorMessage(updateError))
    } finally {
      setActionId(null)
    }
  }

  function cancelRequest(id) {
    const connection = connections.find((item) => item.id === id)
    if (!connection) return

    confirmationTriggerRef.current = document.activeElement
    setConfirmation({
      id,
      title: 'Hủy lời mời kết nối?',
      message: `Lời mời gửi cho ${connection.name} sẽ được hủy.`,
      actionLabel: 'Hủy lời mời',
    })
  }

  function disconnectConnection(id) {
    const connection = connections.find((item) => item.id === id)
    if (!connection) return

    confirmationTriggerRef.current = document.activeElement
    setConfirmation({
      id,
      title: 'Ngắt kết nối?',
      message: `Cậu và ${connection.name} sẽ không còn ở trạng thái kết nối. Lịch sử tin nhắn vẫn được giữ lại.`,
      actionLabel: 'Ngắt kết nối',
    })
  }

  function closeConfirmation() {
    setConfirmation(null)
    confirmationTriggerRef.current?.focus({ preventScroll: true })
  }

  async function confirmConnectionAction() {
    if (!confirmation) return

    const { id } = confirmation
    setConfirmation(null)
    await updateRequest(id, 'cancelled')
    confirmationTriggerRef.current?.focus({ preventScroll: true })
  }

  function openChat(id) {
    lastChatTriggerRef.current = document.activeElement
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    shouldFocusChatRef.current = window.matchMedia('(max-width: 760px)').matches
    setChatId(id)
    setDraft('')
  }

  function closeChat() {
    setChatId(null)
    setDraft('')
    lastChatTriggerRef.current?.focus({ preventScroll: true })
  }

  async function sendMessage(event) {
    event.preventDefault()

    const text = draft.trim()
    const userId = messageUserIdRef.current
    if (!text || !chat || !userId || isSendingMessage) return

    const connectionRequestId = chat.id
    setIsSendingMessage(true)
    setError('')

    try {
      const { data: insertedMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          id: crypto.randomUUID(),
          connection_request_id: connectionRequestId,
          sender_id: userId,
          body: text,
        })
        .select('id, connection_request_id, sender_id, body, created_at')
        .single()

      if (insertError) throw insertError

      const message = mapMessage(insertedMessage, userId)
      setConnections((current) => current.map((item) =>
        item.id === connectionRequestId
          ? { ...item, messages: mergeMessages(item.messages, [message]) }
          : item
      ))
      setDraft('')
    } catch (sendError) {
      setError(getMessageErrorMessage(sendError))
    } finally {
      setIsSendingMessage(false)
    }
  }

  return (
    <AppLayout>
      <section className="discover-page matches-page">
        <header className="discover-header">
          <div>
            <p className="page-eyebrow">KẾT NỐI</p>
            <h1>Biến lời mời thành những cuộc trò chuyện có ích.</h1>
            <p>Quản lý kết nối, phản hồi lời mời và tiếp tục trao đổi tại một nơi.</p>
          </div>

          <Link to="/discover" className="banner-button">
            Tìm thêm bạn
          </Link>
        </header>

        <p className="discover-demo-note">
          Lời mời và tin nhắn được đồng bộ an toàn qua Supabase.
        </p>

        <div className="matches-summary">
          <div className="matches-summary-copy">
            <span className="summary-live-dot" />
            <div><strong>Không gian kết nối của cậu</strong><small>Tin nhắn mới được cập nhật theo thời gian thực.</small></div>
          </div>
          <div className="matches-summary-stats">
            <span><strong>{pendingCount}</strong> đang chờ</span>
            <span><strong>{acceptedCount}</strong> đã kết nối</span>
          </div>
        </div>

        {error && (
          <div className="form-error-banner" role="alert">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="matches-status-message" role="status" aria-live="polite">
            <Icon name="connection" /> {statusMessage}
          </div>
        )}

        {isLoading && (
          <div className="form-error-banner" role="status" aria-live="polite">
            Đang tải lời mời kết nối…
          </div>
        )}

        {confirmation && (
          <div className="discover-dialog-backdrop" role="presentation">
            <section
              className="discover-profile-dialog connection-confirmation-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="connection-confirmation-title"
              aria-describedby="connection-confirmation-message"
            >
              <div className="discover-dialog-body">
                <div className="discover-dialog-section">
                  <h2 id="connection-confirmation-title">{confirmation.title}</h2>
                  <p id="connection-confirmation-message">{confirmation.message}</p>
                </div>
              </div>
              <footer className="discover-dialog-actions">
                <button
                  type="button"
                  className="view-student-button"
                  onClick={closeConfirmation}
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  className="connect-student-button"
                  autoFocus
                  disabled={actionId === confirmation.id}
                  onClick={confirmConnectionAction}
                >
                  {actionId === confirmation.id ? 'Đang cập nhật…' : confirmation.actionLabel}
                </button>
              </footer>
            </section>
          </div>
        )}

        <div className="purpose-tabs matches-tabs" role="tablist" aria-label="Trạng thái kết nối">
          <button
            type="button"
            className={tab === 'pending' ? 'active' : ''}
            id="pending-tab"
            role="tab"
            aria-selected={tab === 'pending'}
            aria-controls="matches-panel"
            onClick={() => {
              setTab('pending')
              closeChat()
            }}
          >
            Đang chờ ({pendingCount})
          </button>

          <button
            type="button"
            className={tab === 'accepted' ? 'active' : ''}
            id="accepted-tab"
            role="tab"
            aria-selected={tab === 'accepted'}
            aria-controls="matches-panel"
            onClick={() => {
              setTab('accepted')
              closeChat()
            }}
          >
            Đã kết nối ({acceptedCount})
          </button>
        </div>

        {!isLoading && visibleConnections.length === 0 ? (
          <div id="matches-panel" role="tabpanel" aria-labelledby={`${tab}-tab`} className="discover-empty-state">
            <h2>
              {tab === 'pending'
                ? 'Chưa có lời mời đang chờ'
                : 'Chưa có kết nối được chấp nhận'}
            </h2>
            <p>
              {tab === 'pending'
                ? 'Tìm người phù hợp trong trang Khám phá.'
                : 'Kết nối sẽ xuất hiện tại đây sau khi lời mời được chấp nhận.'}
            </p>
            <Link to="/discover">Mở Khám phá →</Link>
          </div>
        ) : tab === 'accepted' ? (
          <div id="matches-panel" role="tabpanel" aria-labelledby="accepted-tab" className={`messenger-workspace ${chat ? 'has-active-chat' : ''}`}>
            <aside className="conversation-list" aria-label="Danh sách cuộc trò chuyện">
              <div className="conversation-list-header">
                <div>
                  <h2>Cuộc trò chuyện</h2>
                  <p>{acceptedConnections.length} kết nối đã chấp nhận</p>
                </div>
              </div>

              <div className="conversation-list-items">
                {acceptedConnections.map((item) => {
                  const lastMessage = item.messages[item.messages.length - 1]

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`conversation-item ${chatId === item.id ? 'active' : ''}`}
                      aria-pressed={chatId === item.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openChat(item.id)}
                    >
                      <span className="conversation-avatar">
                        {item.name.trim().split(/\s+/).pop()?.[0] || '?'}
                      </span>
                      <span className="conversation-item-copy">
                        <strong>{item.name}</strong>
                        <small>{lastMessage?.text || item.purpose || 'Sẵn sàng trò chuyện'}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </aside>

            {chat ? (
              <section className="chat-panel" aria-label={`Trò chuyện với ${chat.name}`}>
                <header className="chat-header">
                  <button
                    type="button"
                    className="chat-back-button"
                    onClick={closeChat}
                  >
                    <Icon name="arrow" /> Quay lại
                  </button>
                  <div className="chat-header-person">
                    <span className="conversation-avatar">
                      {chat.name.trim().split(/\s+/).pop()?.[0] || '?'}
                    </span>
                    <div>
                      <h2 ref={chatHeadingRef} tabIndex="-1">{chat.name}</h2>
                      <p><span className="chat-status-dot" /> Đã kết nối · {chat.purpose || 'Cộng đồng sinh viên'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chat-close-button"
                    onClick={closeChat}
                  >
                    Đóng trò chuyện
                  </button>
                  <button
                    type="button"
                    className="view-student-button"
                    onClick={() => disconnectConnection(chat.id)}
                  >
                    Ngắt kết nối
                  </button>
                </header>

                <div
                  ref={messageListRef}
                  className="chat-message-list"
                  role="log"
                  aria-label={`Tin nhắn với ${chat.name}`}
                  aria-live="polite"
                >
                  {chat.messages.length === 0 && (
                    <p className="chat-empty-message">Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.</p>
                  )}

                  {chat.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-message ${message.sender === 'me' ? 'from-me' : 'from-other'}`}
                    >
                      <strong>
                        {message.sender === 'me' ? 'Cậu' : chat.name}
                      </strong>
                      <div>{message.text}</div>
                    </div>
                  ))}
                </div>

                <form className="chat-composer" onSubmit={sendMessage}>
                  <label className="profile-field">
                    <span>Tin nhắn</span>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Nhập lời chào..."
                      maxLength={1000}
                      required
                    />
                  </label>

                  <div className="chat-composer-actions">
                    <button
                      type="submit"
                      className="connect-student-button"
                      disabled={!draft.trim() || isSendingMessage}
                      aria-busy={isSendingMessage}
                    >
                      {isSendingMessage ? 'Đang gửi…' : 'Gửi tin nhắn'}
                    </button>

                  </div>
                </form>
              </section>
            ) : (
              <div className="chat-placeholder" role="status">
                <div className="chat-placeholder-icon" aria-hidden="true">C</div>
                <h2>Chọn một cuộc trò chuyện</h2>
                <p>Chọn một kết nối bên trái để tiếp tục trao đổi.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="student-card-grid">
            {visibleConnections.map((item) => (
              <article className="discover-student-card connection-card" key={item.id}>
                <div className="discover-avatar">
                  {item.name.trim().split(/\s+/).pop()?.[0] || '?'}
                </div>

                <div className="student-main-info">
                  <h2>{item.name}</h2>
                  <p>{item.major}</p>
                </div>

                <span className="student-purpose">{item.purpose}</span>

                <p className="student-location">
                  {[item.city, item.area, item.location]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                <p className="student-about">
                  {item.status === 'pending'
                    ? item.isIncoming
                      ? 'Lời mời đang chờ cậu phản hồi.'
                      : 'Đã gửi lời mời. Chưa thể trò chuyện.'
                    : 'Đã kết nối. Có thể bắt đầu trò chuyện.'}
                </p>

                <div className="student-card-actions">
                  {item.status === 'pending' ? (
                    <>
                      {item.isIncoming ? (
                        <>
                          <button
                            type="button"
                            className="view-student-button"
                            disabled={actionId === item.id}
                            onClick={() => updateRequest(item.id, 'declined')}
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            className="connect-student-button"
                            disabled={actionId === item.id}
                            onClick={() => updateRequest(item.id, 'accepted')}
                          >
                            {actionId === item.id ? 'Đang cập nhật…' : 'Chấp nhận'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="view-student-button"
                          disabled={actionId === item.id}
                          onClick={() => cancelRequest(item.id)}
                        >
                          {actionId === item.id ? 'Đang hủy…' : 'Hủy lời mời'}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="connect-student-button"
                        onClick={() => openChat(item.id)}
                      >
                        Mở trò chuyện
                      </button>
                      <button
                        type="button"
                        className="view-student-button"
                        onClick={() => disconnectConnection(item.id)}
                      >
                        Ngắt kết nối
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

      </section>
    </AppLayout>
  )
}
