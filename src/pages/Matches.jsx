import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { useConnectionRequestRefresh } from '../hooks/useConnectionRequestRefresh'
import {
  applyReadReceipts,
  formatMessageTimestamp,
  getLatestOwnMessageId,
  getMessageDeliveryLabel,
  getUnreadMessageCount,
  mapMessage,
  mergeMessages,
  MESSAGE_PAGE_SIZE,
  normalizeMessagePage,
} from '../lib/messageState'
import { normalizeConnectionRequests } from '../lib/profileAccess'
import {
  parseCocoPlanDeepLink,
  parseConnectionNotificationDeepLink,
} from '../lib/notificationNavigation'
import { parseMatchesOverviewTarget } from '../lib/appNavigation'
import { supabase } from '../lib/supabaseClient'
import SafetyActions from '../components/SafetyActions'
import TrustBadge from '../components/TrustBadge'
import DataRecoveryState from '../components/DataRecoveryState'
import CocoPlanCard from '../components/CocoPlanCard'
import CocoPlanDialog from '../components/CocoPlanDialog'
import {
  buildCocoPlanInsert,
  canCompleteCocoPlan,
  EMPTY_COCO_PLAN_DRAFT,
  getCocoPlanDraftErrors,
  getDefaultCocoPlanStartAt,
  mapCocoPlan,
  mergeCocoPlans,
} from '../lib/cocoPlan'
import {
  createTypingPayload,
  isTypingEventForConversation,
  TYPING_HEARTBEAT_MS,
  TYPING_IDLE_MS,
} from '../lib/typingState'
import {
  filterConversations,
  formatConversationActivityTime,
  getConversationActivityDate,
  sortConversationsByActivity,
} from '../lib/conversationFilters'

const purposeLabels = {
  study_group: 'Học nhóm',
  team_project: 'Team Project',
  roommates: 'Ghép trọ',
}

const terminalConnectionNotificationMessages = {
  request_declined: 'Lời mời kết nối đã bị từ chối và không còn trong danh sách chờ.',
  request_cancelled: 'Lời mời kết nối đã bị hủy và không còn trong danh sách chờ.',
  connection_disconnected: 'Kết nối đã được ngắt và cuộc trò chuyện không còn khả dụng.',
}

function mapRequest(request, userId, messagePagesByRequest, plansByRequest) {
  const isIncoming = request.recipient_id === userId
  const otherProfile = isIncoming ? request.requester : request.recipient
  const messagePage = messagePagesByRequest.get(request.id)

  return {
    id: request.id,
    profileId: otherProfile?.id,
    name: otherProfile?.full_name?.trim() || 'Sinh viên CocoApp',
    major: otherProfile?.major?.trim() || 'Chưa cập nhật ngành học',
    purpose: purposeLabels[request.purpose] || 'Kết nối',
    city: otherProfile?.city?.trim() || '',
    area: otherProfile?.area?.trim() || '',
    location: otherProfile?.public_location?.trim() || '',
    about: otherProfile?.bio?.trim() || 'Chưa có giới thiệu.',
    email_confirmed: otherProfile?.email_confirmed === true,
    education_email: otherProfile?.education_email === true,
    verification_status: otherProfile?.verification_status || 'unverified',
    introMessage: request.intro_message?.trim() || '',
    status: request.status,
    isIncoming,
    requesterId: request.requester_id,
    recipientId: request.recipient_id,
    createdAt: request.created_at,
    respondedAt: request.responded_at,
    messages: messagePage?.messages || [],
    hasOlderMessages: messagePage?.hasOlder || false,
    unreadCount: messagePage?.unreadCount || 0,
    plan: plansByRequest.get(request.id) || null,
  }
}

function getMatchesErrorMessage(error) {
  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Không thể tải hoặc cập nhật lời mời do quyền truy cập. Hãy đăng nhập lại.'
  }

  return 'Không thể tải danh sách kết nối. Hãy thử lại sau.'
}

function getMessageErrorMessage(error) {
  if (error?.message?.toLowerCase().includes('blocked')) {
    return 'Không thể gửi tin nhắn vì kết nối này đã bị chặn.'
  }

  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Không thể gửi tin nhắn. Hãy kiểm tra kết nối vẫn đang được chấp nhận.'
  }

  return 'Chưa gửi được tin nhắn. Hãy thử lại.'
}

function getPlanErrorMessage(error) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'Cuộc trò chuyện này đã có một kế hoạch đang hoạt động.'
  }

  if (message.includes('blocked')) {
    return 'Không thể cập nhật kế hoạch khi một trong hai tài khoản đang chặn nhau.'
  }

  if (message.includes('expired') || message.includes('future')) {
    return 'Thời gian kế hoạch không còn hợp lệ. Hãy chọn một thời điểm mới.'
  }

  if (message.includes('row-level security') || message.includes('permission')) {
    return 'Cậu không có quyền thực hiện thay đổi này hoặc kết nối không còn hiệu lực.'
  }

  return 'Chưa cập nhật được Coco Plan. Hãy thử lại.'
}

async function markReceivedMessagesRead(connectionRequestId, userId) {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('connection_request_id', connectionRequestId)
    .neq('sender_id', userId)
    .is('read_at', null)
    .select('id, connection_request_id, read_at')

  if (error) throw error
  return data || []
}

function mergeConnections(serverConnections, currentConnections) {
  const currentById = new Map(currentConnections.map((item) => [item.id, item]))

  return serverConnections.map((item) => {
    const current = currentById.get(item.id)
    if (!current) return item

    return {
      ...item,
      messages: mergeMessages(item.messages, current.messages),
      hasOlderMessages: current.hasOlderMessages,
      plan: mergeCocoPlans(item.plan, current.plan),
    }
  })
}

async function fetchMessagePage(connectionRequestId, userId, beforeMessage = null) {
  let query = supabase
    .from('messages')
    .select('id, connection_request_id, sender_id, body, created_at, read_at')
    .eq('connection_request_id', connectionRequestId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE + 1)

  if (beforeMessage) {
    query = query.or(
      `created_at.lt.${beforeMessage.createdAt},and(created_at.eq.${beforeMessage.createdAt},id.lt.${beforeMessage.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error

  return normalizeMessagePage(data || [], userId)
}

async function fetchUnreadMessageCount(connectionRequestId, userId) {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('connection_request_id', connectionRequestId)
    .neq('sender_id', userId)
    .is('read_at', null)

  if (error) throw error
  return count || 0
}

async function fetchConversationState(connectionRequestId, userId) {
  const [messagePage, unreadCount] = await Promise.all([
    fetchMessagePage(connectionRequestId, userId),
    fetchUnreadMessageCount(connectionRequestId, userId),
  ])

  return {
    ...messagePage,
    unreadCount,
  }
}

async function fetchConnections() {
  const user = await getCurrentAccount()
  if (!user) throw new Error('Phiên đăng nhập đã hết.')

  const { data: requestRows, error } = await supabase
    .rpc('get_my_connection_requests')

  if (error) throw error

  const requests = normalizeConnectionRequests(requestRows)

  const acceptedRequestIds = (requests || [])
    .filter((request) => request.status === 'accepted')
    .map((request) => request.id)
  const messagePagesByRequest = new Map()
  const plansByRequest = new Map()

  if (acceptedRequestIds.length > 0) {
    const [messagePages, planResult] = await Promise.all([
      Promise.all(
        acceptedRequestIds.map(async (requestId) => [
          requestId,
          await fetchConversationState(requestId, user.id),
        ])
      ),
      supabase
        .from('connection_plans')
        .select(`
          id,
          connection_request_id,
          proposer_id,
          title,
          starts_at,
          mode,
          location_note,
          status,
          created_at,
          updated_at
        `)
        .in('connection_request_id', acceptedRequestIds)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
    ])

    if (planResult.error) throw planResult.error

    for (const [requestId, messagePage] of messagePages) {
      messagePagesByRequest.set(requestId, messagePage)
    }

    for (const planRow of planResult.data || []) {
      if (!plansByRequest.has(planRow.connection_request_id)) {
        plansByRequest.set(
          planRow.connection_request_id,
          mapCocoPlan(planRow, user.id)
        )
      }
    }
  }

  return {
    userId: user.id,
    connections: (requests || []).map((request) => (
      mapRequest(request, user.id, messagePagesByRequest, plansByRequest)
    )),
  }
}

async function fetchLinkedCocoPlan(connectionRequestId, planId, userId) {
  const { data, error } = await supabase
    .from('connection_plans')
    .select(`
      id,
      connection_request_id,
      proposer_id,
      title,
      starts_at,
      mode,
      location_note,
      status,
      created_at,
      updated_at
    `)
    .eq('id', planId)
    .eq('connection_request_id', connectionRequestId)
    .maybeSingle()

  if (error) throw error
  return data ? mapCocoPlan(data, userId) : null
}

export default function Matches() {
  const location = useLocation()
  const planDeepLink = parseCocoPlanDeepLink(location.search)
  const deepLinkConnectionId = planDeepLink?.connectionId ?? null
  const deepLinkPlanId = planDeepLink?.planId ?? null
  const planDeepLinkKey = deepLinkConnectionId && deepLinkPlanId
    ? `${deepLinkConnectionId}:${deepLinkPlanId}:${location.key}`
    : null
  const connectionNotificationDeepLink = parseConnectionNotificationDeepLink(location.search)
  const connectionDeepLinkKind = connectionNotificationDeepLink?.kind ?? null
  const connectionDeepLinkTab = connectionNotificationDeepLink?.tab ?? null
  const connectionDeepLinkConnectionId = connectionNotificationDeepLink?.connectionId ?? null
  const connectionDeepLinkNotificationType = connectionNotificationDeepLink?.notificationType ?? null
  const connectionNotificationDeepLinkKey = connectionNotificationDeepLink
    ? `${connectionDeepLinkKind}:${connectionDeepLinkConnectionId || connectionDeepLinkNotificationType}:${location.key}`
    : null
  const matchesOverviewTab = parseMatchesOverviewTarget(location.search)
  const [connections, setConnections] = useState([])
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [tab, setTab] = useState(matchesOverviewTab || 'pending')
  const [chatId, setChatId] = useState(null)
  const [draft, setDraft] = useState('')
  const [conversationQuery, setConversationQuery] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [typingConnectionId, setTypingConnectionId] = useState(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [loadingOlderId, setLoadingOlderId] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [planDialogConnectionId, setPlanDialogConnectionId] = useState(null)
  const [planDraft, setPlanDraft] = useState({ ...EMPTY_COCO_PLAN_DRAFT })
  const [planErrors, setPlanErrors] = useState({})
  const [planValidationAttempt, setPlanValidationAttempt] = useState(0)
  const [planSubmitError, setPlanSubmitError] = useState('')
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [planAction, setPlanAction] = useState(null)
  const [linkedPlan, setLinkedPlan] = useState(null)
  const [linkedPlanConnectionId, setLinkedPlanConnectionId] = useState(null)
  const chatHeadingRef = useRef(null)
  const messageListRef = useRef(null)
  const lastChatTriggerRef = useRef(null)
  const shouldFocusChatRef = useRef(false)
  const confirmationTriggerRef = useRef(null)
  const confirmationDialogRef = useRef(null)
  const planDialogTriggerRef = useRef(null)
  const planDialogConnectionIdRef = useRef(null)
  const planPanelHeadingRef = useRef(null)
  const messageUserIdRef = useRef(null)
  const activeChatIdRef = useRef(null)
  const matchesMountedRef = useRef(false)
  const hasLoadedConnectionsRef = useRef(false)
  const refreshConnectionsPromiseRef = useRef(null)
  const refreshConnectionsQueuedRef = useRef(false)
  const linkedPlanRef = useRef(null)
  const linkedPlanTargetRef = useRef(null)
  const handledPlanDeepLinkRef = useRef(null)
  const loadingPlanDeepLinkRef = useRef(null)
  const handledConnectionDeepLinkRef = useRef(null)
  const loadingConnectionDeepLinkRef = useRef(null)
  const deepLinkInteractionRef = useRef(0)
  const pendingConnectionCardRefs = useRef(new Map())
  const pendingConnectionFocusRef = useRef(null)
  const chatFocusGenerationRef = useRef(null)
  const typingChannelRef = useRef(null)
  const typingChannelConnectionIdRef = useRef(null)
  const typingSubscribedRef = useRef(false)
  const localTypingActiveRef = useRef(false)
  const lastTypingBroadcastAtRef = useRef(0)
  const typingIdleTimerRef = useRef(null)
  const remoteTypingTimerRef = useRef(null)

  const sendTypingState = useCallback((isTyping) => {
    const channel = typingChannelRef.current
    const connectionRequestId = typingChannelConnectionIdRef.current
    const senderId = messageUserIdRef.current
    const now = Date.now()

    if (!channel || !typingSubscribedRef.current || !connectionRequestId || !senderId) return
    if (
      isTyping
      && localTypingActiveRef.current
      && now - lastTypingBroadcastAtRef.current < TYPING_HEARTBEAT_MS
    ) return
    if (!isTyping && !localTypingActiveRef.current) return

    localTypingActiveRef.current = isTyping
    lastTypingBroadcastAtRef.current = now
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: createTypingPayload({ connectionRequestId, senderId, isTyping, sentAt: now }),
    })
  }, [])

  const stopLocalTyping = useCallback(() => {
    if (typingIdleTimerRef.current) {
      window.clearTimeout(typingIdleTimerRef.current)
      typingIdleTimerRef.current = null
    }
    sendTypingState(false)
  }, [sendTypingState])

  const clearRemoteTyping = useCallback(() => {
    if (remoteTypingTimerRef.current) {
      window.clearTimeout(remoteTypingTimerRef.current)
      remoteTypingTimerRef.current = null
    }
    setTypingConnectionId(null)
  }, [])

  const invalidateDeepLinkNavigation = useCallback(() => {
    deepLinkInteractionRef.current += 1
    loadingPlanDeepLinkRef.current = null
    loadingConnectionDeepLinkRef.current = null
    pendingConnectionFocusRef.current = null
    chatFocusGenerationRef.current = null

    if (planDeepLinkKey) {
      handledPlanDeepLinkRef.current = planDeepLinkKey
    }
    if (connectionNotificationDeepLinkKey) {
      handledConnectionDeepLinkRef.current = connectionNotificationDeepLinkKey
    }
  }, [connectionNotificationDeepLinkKey, planDeepLinkKey])

  const clearChatState = useCallback(({ restoreFocus = false } = {}) => {
    stopLocalTyping()
    clearRemoteTyping()
    activeChatIdRef.current = null
    shouldFocusChatRef.current = false
    chatFocusGenerationRef.current = null
    setChatId(null)
    setDraft('')
    setLinkedPlan(null)
    setLinkedPlanConnectionId(null)
    planDialogConnectionIdRef.current = null
    setPlanDialogConnectionId(null)

    if (restoreFocus) {
      lastChatTriggerRef.current?.focus({ preventScroll: true })
    }
  }, [clearRemoteTyping, stopLocalTyping])

  useEffect(() => {
    if (!matchesOverviewTab) return

    invalidateDeepLinkNavigation()
    clearChatState()
    setTab(matchesOverviewTab)
    setStatusMessage('')
  }, [clearChatState, invalidateDeepLinkNavigation, location.key, matchesOverviewTab])

  const focusAfterConfirmation = useCallback(() => {
    window.requestAnimationFrame(() => {
      const trigger = confirmationTriggerRef.current
      if (trigger?.isConnected) {
        trigger.focus({ preventScroll: true })
      } else if (planPanelHeadingRef.current?.isConnected) {
        planPanelHeadingRef.current.focus({ preventScroll: true })
      } else if (chatHeadingRef.current?.isConnected) {
        chatHeadingRef.current.focus({ preventScroll: true })
      } else {
        lastChatTriggerRef.current?.focus({ preventScroll: true })
      }
    })
  }, [])

  const markConversationRead = useCallback(async (id) => {
    const userId = messageUserIdRef.current
    if (!userId) return

    try {
      const receipts = await markReceivedMessagesRead(id, userId)
      if (!matchesMountedRef.current) return

      setConnections((current) => applyReadReceipts(current, receipts))
      const unreadCount = await fetchUnreadMessageCount(id, userId)
      if (matchesMountedRef.current) {
        setConnections((current) => current.map((item) => (
          item.id === id ? { ...item, unreadCount } : item
        )))
      }
    } catch {
      if (matchesMountedRef.current) {
        setError('Chưa đánh dấu được tin nhắn là đã đọc.')
      }
    }
  }, [])

  useEffect(() => {
    matchesMountedRef.current = true
    return () => {
      matchesMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    linkedPlanRef.current = linkedPlan
  }, [linkedPlan])

  useEffect(() => {
    const nextTarget = deepLinkConnectionId && deepLinkPlanId
      ? `${deepLinkConnectionId}:${deepLinkPlanId}`
      : null

    if (linkedPlanTargetRef.current === nextTarget) return

    linkedPlanTargetRef.current = nextTarget
    setLinkedPlan(null)
    setLinkedPlanConnectionId(null)
  }, [deepLinkConnectionId, deepLinkPlanId])

  const refreshConnections = useCallback(function runRefreshConnections() {
    if (refreshConnectionsPromiseRef.current) {
      refreshConnectionsQueuedRef.current = true
      return refreshConnectionsPromiseRef.current
    }

    const refreshPromise = fetchConnections()
      .then(({ userId, connections: nextConnections }) => {
        if (!matchesMountedRef.current) return

        messageUserIdRef.current = userId
        setConnections((current) => mergeConnections(nextConnections, current))

        const openPlanConnectionId = planDialogConnectionIdRef.current
        if (
          openPlanConnectionId
          && !nextConnections.some((item) => (
            item.id === openPlanConnectionId && item.status === 'accepted'
          ))
        ) {
          planDialogConnectionIdRef.current = null
          setPlanDialogConnectionId(null)
          setPlanErrors({})
          setPlanSubmitError('')
          window.requestAnimationFrame(() => {
            if (chatHeadingRef.current?.isConnected) {
              chatHeadingRef.current.focus({ preventScroll: true })
            } else {
              lastChatTriggerRef.current?.focus({ preventScroll: true })
            }
          })
        }

        hasLoadedConnectionsRef.current = true
        setLoadError('')
        setError('')

        if (
          activeChatIdRef.current
          && document.visibilityState === 'visible'
          && document.hasFocus()
        ) {
          const connectionRequestId = activeChatIdRef.current

          void markReceivedMessagesRead(connectionRequestId, userId)
            .then((receipts) => {
              if (matchesMountedRef.current) {
                setConnections((current) => applyReadReceipts(current, receipts))
              }

              return fetchUnreadMessageCount(connectionRequestId, userId)
            })
            .then((unreadCount) => {
              if (matchesMountedRef.current) {
                setConnections((current) => current.map((item) => (
                  item.id === connectionRequestId
                    ? { ...item, unreadCount }
                    : item
                )))
              }
            })
            .catch(() => {
              if (matchesMountedRef.current) {
                setError('Chưa đánh dấu được tin nhắn là đã đọc.')
              }
            })
        }
      })
      .finally(() => {
        if (refreshConnectionsPromiseRef.current === refreshPromise) {
          refreshConnectionsPromiseRef.current = null
        }
        if (matchesMountedRef.current) setIsLoading(false)

        if (matchesMountedRef.current && refreshConnectionsQueuedRef.current) {
          refreshConnectionsQueuedRef.current = false
          void runRefreshConnections().catch((loadError) => {
            if (matchesMountedRef.current) {
              setError(getMatchesErrorMessage(loadError))
            }
          })
        }
      })

    refreshConnectionsPromiseRef.current = refreshPromise
    return refreshPromise
  }, [])

  useConnectionRequestRefresh(refreshConnections, {
    onError: (loadError) => {
      if (matchesMountedRef.current) {
        const message = getMatchesErrorMessage(loadError)
        if (hasLoadedConnectionsRef.current) {
          setError(`Chưa làm mới được kết nối. ${message}`)
        } else {
          setLoadError(message)
        }
      }
    },
  })

  async function retryConnections() {
    setIsLoading(true)
    setLoadError('')

    try {
      await refreshConnections()
    } catch (refreshError) {
      if (matchesMountedRef.current) {
        setLoadError(getMatchesErrorMessage(refreshError))
      }
    }
  }

  useEffect(() => {
    let matchesChannel = null

    async function setupMessages() {
      try {
        const user = await getCurrentAccount()
        if (!user || !matchesMountedRef.current) return

        messageUserIdRef.current = user.id

        matchesChannel = supabase
          .channel(`messages:${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'messages' },
            (payload) => {
              if (!matchesMountedRef.current || !payload.new?.connection_request_id) return

              if (payload.eventType === 'INSERT') {
                const message = mapMessage(payload.new, messageUserIdRef.current)

                if (
                  message.sender === 'other'
                  && activeChatIdRef.current === payload.new.connection_request_id
                ) {
                  clearRemoteTyping()
                }

                setConnections((current) => current.map((item) => {
                  if (item.id !== payload.new.connection_request_id) return item
                  if (item.messages.some((currentMessage) => currentMessage.id === message.id)) {
                    return item
                  }

                  return {
                    ...item,
                    messages: mergeMessages(item.messages, [message]),
                    unreadCount: getUnreadMessageCount(item) + (
                      message.sender === 'other' ? 1 : 0
                    ),
                  }
                }))

                if (activeChatIdRef.current === payload.new.connection_request_id) {
                  window.requestAnimationFrame(() => {
                    const messageList = messageListRef.current
                    if (messageList) messageList.scrollTop = messageList.scrollHeight
                  })
                }

                if (
                  message.sender === 'other'
                  && activeChatIdRef.current === payload.new.connection_request_id
                  && document.visibilityState === 'visible'
                  && document.hasFocus()
                ) {
                  void markReceivedMessagesRead(
                    payload.new.connection_request_id,
                    messageUserIdRef.current
                  )
                    .then((receipts) => {
                      if (matchesMountedRef.current) {
                        setConnections((current) => applyReadReceipts(current, receipts))
                      }

                      return fetchUnreadMessageCount(
                        payload.new.connection_request_id,
                        messageUserIdRef.current
                      )
                    })
                    .then((unreadCount) => {
                      if (matchesMountedRef.current) {
                        setConnections((current) => current.map((item) => (
                          item.id === payload.new.connection_request_id
                            ? { ...item, unreadCount }
                            : item
                        )))
                      }
                    })
                    .catch(() => {
                      if (matchesMountedRef.current) {
                        setError('Chưa đánh dấu được tin nhắn là đã đọc.')
                      }
                    })
                }
              } else if (payload.eventType === 'UPDATE') {
                setConnections((current) => current.map((item) => (
                  item.id === payload.new.connection_request_id
                    ? {
                        ...item,
                        unreadCount: item.messages.some((message) => (
                          message.id === payload.new.id && message.readAt === null
                        ))
                          ? Math.max(0, getUnreadMessageCount(item) - 1)
                          : getUnreadMessageCount(item),
                        messages: item.messages.map((message) => (
                          message.id === payload.new.id
                            ? { ...message, readAt: payload.new.read_at }
                            : message
                        )),
                      }
                    : item
                )))

                void refreshConnections().catch((loadError) => {
                  if (matchesMountedRef.current) {
                    setError(getMatchesErrorMessage(loadError))
                  }
                })
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'connection_plans' },
            (payload) => {
              if (
                payload.eventType === 'UPDATE'
                && payload.new?.id === linkedPlanRef.current?.id
                && messageUserIdRef.current
              ) {
                setLinkedPlan(mapCocoPlan(payload.new, messageUserIdRef.current))
              }

              void refreshConnections().catch((loadError) => {
                if (matchesMountedRef.current) {
                  setError(getPlanErrorMessage(loadError))
                }
              })
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void refreshConnections().catch((loadError) => {
                if (matchesMountedRef.current) setError(getMatchesErrorMessage(loadError))
              })
            }
          })
      } catch (loadError) {
        if (matchesMountedRef.current) setError(getMatchesErrorMessage(loadError))
      }
    }

    void setupMessages()

    return () => {
      if (matchesChannel) void supabase.removeChannel(matchesChannel)
    }
  }, [clearRemoteTyping, refreshConnections])

  useEffect(() => {
    clearRemoteTyping()
    stopLocalTyping()

    if (!chatId) return undefined

    const connectionRequestId = chatId
    const typingChannel = supabase
      .channel(`conversation-typing:${connectionRequestId}`, {
        config: { broadcast: { self: false, ack: false } },
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (
          !matchesMountedRef.current
          || activeChatIdRef.current !== connectionRequestId
          || !isTypingEventForConversation(payload, {
            connectionRequestId,
            currentUserId: messageUserIdRef.current,
          })
        ) return

        clearRemoteTyping()

        if (!payload.isTyping) {
          return
        }

        setTypingConnectionId(connectionRequestId)
        remoteTypingTimerRef.current = window.setTimeout(() => {
          if (matchesMountedRef.current) setTypingConnectionId(null)
          remoteTypingTimerRef.current = null
        }, TYPING_IDLE_MS + 1200)
      })
      .subscribe((status) => {
        if (typingChannelRef.current === typingChannel) {
          typingSubscribedRef.current = status === 'SUBSCRIBED'
        }
      })

    typingChannelRef.current = typingChannel
    typingChannelConnectionIdRef.current = connectionRequestId
    typingSubscribedRef.current = false
    localTypingActiveRef.current = false
    lastTypingBroadcastAtRef.current = 0

    return () => {
      if (typingChannelRef.current === typingChannel) {
        if (localTypingActiveRef.current && messageUserIdRef.current) {
          void typingChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: createTypingPayload({
              connectionRequestId,
              senderId: messageUserIdRef.current,
              isTyping: false,
            }),
          })
        }

        typingChannelRef.current = null
        typingChannelConnectionIdRef.current = null
        typingSubscribedRef.current = false
        localTypingActiveRef.current = false
      }

      if (typingIdleTimerRef.current) {
        window.clearTimeout(typingIdleTimerRef.current)
        typingIdleTimerRef.current = null
      }
      if (remoteTypingTimerRef.current) {
        window.clearTimeout(remoteTypingTimerRef.current)
        remoteTypingTimerRef.current = null
      }

      void supabase.removeChannel(typingChannel)
    }
  }, [chatId, clearRemoteTyping, stopLocalTyping])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') stopLocalTyping()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [stopLocalTyping])

  const pendingCount = connections.filter(
    (item) => item.status === 'pending'
  ).length

  const acceptedCount = connections.filter(
    (item) => item.status === 'accepted'
  ).length

  const chat = connections.find(
    (item) => item.id === chatId && item.status === 'accepted'
  )
  const latestOwnMessageId = chat
    ? getLatestOwnMessageId(chat.messages)
    : null
  const deepLinkConnection = deepLinkConnectionId
    ? connections.find((item) => item.id === deepLinkConnectionId)
    : null
  const isDeepLinkConnectionAccepted = deepLinkConnection?.status === 'accepted'
  const displayedPlan = chat
    && linkedPlanConnectionId === chat.id
    && linkedPlan
    ? linkedPlan
    : chat?.plan
  const hasNewerActivePlan = Boolean(
    linkedPlan
    && chat?.plan
    && linkedPlan.id !== chat.plan.id
    && ['proposed', 'accepted'].includes(chat.plan.status)
  )

  const planDialogConnection = connections.find(
    (item) => item.id === planDialogConnectionId && item.status === 'accepted'
  )

  const acceptedConnections = connections.filter(
    (item) => item.status === 'accepted'
  )
  const activityOrderedConnections = sortConversationsByActivity(acceptedConnections)
  const filteredAcceptedConnections = filterConversations(activityOrderedConnections, {
    query: conversationQuery,
    unreadOnly: showUnreadOnly,
  })
  const visibleConnections = tab === 'accepted'
    ? filteredAcceptedConnections
    : connections.filter((item) => item.status === tab)
  const totalUnreadCount = acceptedConnections.reduce(
    (total, connection) => total + getUnreadMessageCount(connection),
    0
  )
  const confirmationIsBusy = confirmation?.kind === 'plan'
    ? planAction?.id === confirmation.id
    : actionId === confirmation?.id

  useEffect(() => {
    if (
      !deepLinkConnectionId
      || !deepLinkPlanId
      || isLoading
      || !hasLoadedConnectionsRef.current
    ) {
      return undefined
    }

    if (
      !planDeepLinkKey
      || handledPlanDeepLinkRef.current === planDeepLinkKey
      || loadingPlanDeepLinkRef.current === planDeepLinkKey
    ) {
      return undefined
    }

    loadingPlanDeepLinkRef.current = planDeepLinkKey
    const interactionVersion = deepLinkInteractionRef.current
    let cancelled = false

    async function openLinkedPlan() {
      if (!isDeepLinkConnectionAccepted) {
        handledPlanDeepLinkRef.current = planDeepLinkKey
        loadingPlanDeepLinkRef.current = null
        setStatusMessage('Coco Plan này không còn thuộc một kết nối đang hoạt động.')
        return
      }

      const userId = messageUserIdRef.current
      if (!userId) {
        loadingPlanDeepLinkRef.current = null
        return
      }

      try {
        const exactPlan = await fetchLinkedCocoPlan(
          deepLinkConnectionId,
          deepLinkPlanId,
          userId
        )
        if (
          cancelled
          || !matchesMountedRef.current
          || deepLinkInteractionRef.current !== interactionVersion
        ) return

        handledPlanDeepLinkRef.current = planDeepLinkKey
        if (!exactPlan) {
          setStatusMessage('Coco Plan này không còn khả dụng hoặc cậu không có quyền xem.')
          return
        }

        setTab('accepted')
        activeChatIdRef.current = deepLinkConnectionId
        setChatId(deepLinkConnectionId)
        setDraft('')
        setLinkedPlan(exactPlan)
        setLinkedPlanConnectionId(deepLinkConnectionId)
        setStatusMessage('Đã mở đúng Coco Plan từ thông báo.')
        void markConversationRead(deepLinkConnectionId)

        window.requestAnimationFrame(() => {
          if (
            deepLinkInteractionRef.current !== interactionVersion
            || activeChatIdRef.current !== deepLinkConnectionId
            || linkedPlanTargetRef.current !== `${deepLinkConnectionId}:${deepLinkPlanId}`
          ) return

          const heading = planPanelHeadingRef.current
          heading?.focus({ preventScroll: true })
          heading?.scrollIntoView({ block: 'center' })
        })
      } catch {
        if (
          !cancelled
          && matchesMountedRef.current
          && deepLinkInteractionRef.current === interactionVersion
        ) {
          handledPlanDeepLinkRef.current = planDeepLinkKey
          setStatusMessage('Chưa mở được Coco Plan từ thông báo. Cậu vẫn có thể chọn cuộc trò chuyện bên dưới.')
        }
      } finally {
        if (
          loadingPlanDeepLinkRef.current === planDeepLinkKey
          && deepLinkInteractionRef.current === interactionVersion
        ) {
          loadingPlanDeepLinkRef.current = null
        }
      }
    }

    void openLinkedPlan()

    return () => {
      cancelled = true
      if (loadingPlanDeepLinkRef.current === planDeepLinkKey) {
        loadingPlanDeepLinkRef.current = null
      }
    }
  }, [
    deepLinkConnectionId,
    deepLinkPlanId,
    isLoading,
    isDeepLinkConnectionAccepted,
    markConversationRead,
    planDeepLinkKey,
  ])

  useEffect(() => {
    if (
      !connectionNotificationDeepLinkKey
      || handledConnectionDeepLinkRef.current === connectionNotificationDeepLinkKey
      || loadingConnectionDeepLinkRef.current === connectionNotificationDeepLinkKey
    ) {
      return undefined
    }

    const interactionVersion = deepLinkInteractionRef.current

    if (connectionDeepLinkKind === 'terminal-event') {
      handledConnectionDeepLinkRef.current = connectionNotificationDeepLinkKey
      pendingConnectionFocusRef.current = null
      clearChatState()
      setTab(connectionDeepLinkTab)
      setStatusMessage(
        terminalConnectionNotificationMessages[connectionDeepLinkNotificationType]
        || 'Trạng thái kết nối đã thay đổi.'
      )
      return undefined
    }

    if (isLoading || !hasLoadedConnectionsRef.current) return undefined

    loadingConnectionDeepLinkRef.current = connectionNotificationDeepLinkKey
    let cancelled = false

    function isCurrentDeepLink() {
      return (
        !cancelled
        && matchesMountedRef.current
        && deepLinkInteractionRef.current === interactionVersion
        && loadingConnectionDeepLinkRef.current === connectionNotificationDeepLinkKey
      )
    }

    async function openConnectionNotificationTarget() {
      try {
        let currentRefresh = refreshConnectionsPromiseRef.current
        while (currentRefresh) {
          try {
            await currentRefresh
          } catch {
            // The authoritative fetch below gets one independent chance to recover.
          }

          if (!isCurrentDeepLink()) return

          const nextRefresh = refreshConnectionsPromiseRef.current
          if (!nextRefresh || nextRefresh === currentRefresh) break
          currentRefresh = nextRefresh
        }

        if (!isCurrentDeepLink()) return

        const { userId, connections: nextConnections } = await fetchConnections()
        if (!isCurrentDeepLink()) return

        const exactConnection = connectionDeepLinkConnectionId
          ? nextConnections.find((item) => item.id === connectionDeepLinkConnectionId)
          : null

        messageUserIdRef.current = userId
        setConnections((current) => mergeConnections(nextConnections, current))
        hasLoadedConnectionsRef.current = true
        setLoadError('')
        setError('')
        handledConnectionDeepLinkRef.current = connectionNotificationDeepLinkKey
        pendingConnectionFocusRef.current = null
        clearChatState()
        setTab(connectionDeepLinkTab)

        if (connectionDeepLinkKind === 'pending-request') {
          if (exactConnection?.status === 'pending' && exactConnection.isIncoming) {
            pendingConnectionFocusRef.current = {
              connectionId: connectionDeepLinkConnectionId,
              interactionVersion,
            }
            setStatusMessage('Đã mở đúng lời mời kết nối từ thông báo.')
          } else {
            setStatusMessage('Lời mời kết nối này không còn chờ cậu phản hồi.')
          }
          return
        }

        if (exactConnection?.status !== 'accepted') {
          setStatusMessage('Kết nối này không còn ở trạng thái đã chấp nhận.')
          return
        }

        shouldFocusChatRef.current = true
        chatFocusGenerationRef.current = interactionVersion
        activeChatIdRef.current = connectionDeepLinkConnectionId
        setChatId(connectionDeepLinkConnectionId)
        setStatusMessage('Đã mở đúng cuộc trò chuyện từ thông báo.')
        void markConversationRead(connectionDeepLinkConnectionId)
      } catch {
        if (!isCurrentDeepLink()) return

        handledConnectionDeepLinkRef.current = connectionNotificationDeepLinkKey
        pendingConnectionFocusRef.current = null
        clearChatState()
        setTab(connectionDeepLinkTab)
        setStatusMessage(
          connectionDeepLinkKind === 'pending-request'
            ? 'Chưa mở được lời mời từ thông báo. Cậu vẫn có thể xem danh sách đang chờ bên dưới.'
            : 'Chưa mở được cuộc trò chuyện từ thông báo. Cậu vẫn có thể chọn một kết nối bên dưới.'
        )
      } finally {
        if (
          loadingConnectionDeepLinkRef.current === connectionNotificationDeepLinkKey
          && deepLinkInteractionRef.current === interactionVersion
        ) {
          loadingConnectionDeepLinkRef.current = null
        }
      }
    }

    void openConnectionNotificationTarget()

    return () => {
      cancelled = true
      if (loadingConnectionDeepLinkRef.current === connectionNotificationDeepLinkKey) {
        loadingConnectionDeepLinkRef.current = null
      }
    }
  }, [
    clearChatState,
    connectionDeepLinkConnectionId,
    connectionDeepLinkKind,
    connectionDeepLinkNotificationType,
    connectionDeepLinkTab,
    connectionNotificationDeepLinkKey,
    isLoading,
    markConversationRead,
  ])

  useEffect(() => {
    const focusTarget = pendingConnectionFocusRef.current
    if (!focusTarget || tab !== 'pending') return undefined

    const targetConnection = connections.find((item) => (
      item.id === focusTarget.connectionId
      && item.status === 'pending'
      && item.isIncoming
    ))
    if (!targetConnection) return undefined

    const frame = window.requestAnimationFrame(() => {
      const latestFocusTarget = pendingConnectionFocusRef.current
      if (
        !latestFocusTarget
        || latestFocusTarget.connectionId !== focusTarget.connectionId
        || latestFocusTarget.interactionVersion !== focusTarget.interactionVersion
        || deepLinkInteractionRef.current !== focusTarget.interactionVersion
        || connectionDeepLinkKind !== 'pending-request'
        || connectionDeepLinkConnectionId !== focusTarget.connectionId
      ) return

      const card = pendingConnectionCardRefs.current.get(focusTarget.connectionId)
      if (!card?.isConnected) return

      card.focus({ preventScroll: true })

      const focusTargetAfterFocus = pendingConnectionFocusRef.current
      if (
        focusTargetAfterFocus?.connectionId !== focusTarget.connectionId
        || focusTargetAfterFocus?.interactionVersion !== focusTarget.interactionVersion
        || deepLinkInteractionRef.current !== focusTarget.interactionVersion
      ) return

      card.scrollIntoView({ block: 'center' })
      pendingConnectionFocusRef.current = null
    })

    return () => window.cancelAnimationFrame(frame)
  }, [
    connections,
    connectionDeepLinkConnectionId,
    connectionDeepLinkKind,
    tab,
  ])

  useEffect(() => {
    if (!confirmation) return undefined

    function handleConfirmationKeyDown(event) {
      if (event.key === 'Escape' && !confirmationIsBusy) {
        event.preventDefault()
        setConfirmation(null)
        focusAfterConfirmation()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = [...confirmationDialogRef.current.querySelectorAll(
        'button:not([disabled])'
      )]

      if (focusable.length === 0) {
        event.preventDefault()
        confirmationDialogRef.current.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleConfirmationKeyDown)
    return () => document.removeEventListener('keydown', handleConfirmationKeyDown)
  }, [confirmation, confirmationIsBusy, focusAfterConfirmation])

  useEffect(() => {
    activeChatIdRef.current = chat?.id ?? null
  }, [chat?.id])

  useEffect(() => {
    if (chat && shouldFocusChatRef.current) {
      const focusGeneration = chatFocusGenerationRef.current
      if (
        focusGeneration !== null
        && deepLinkInteractionRef.current !== focusGeneration
      ) {
        shouldFocusChatRef.current = false
        chatFocusGenerationRef.current = null
        return
      }

      chatHeadingRef.current?.focus({ preventScroll: true })
      shouldFocusChatRef.current = false
      chatFocusGenerationRef.current = null
    }
  }, [chat, chatId])

  useEffect(() => {
    if (chatId !== null) {
      const messageList = messageListRef.current
      if (messageList) messageList.scrollTop = messageList.scrollHeight
    }
  }, [chatId])

  async function updateRequest(id, status) {
    const request = connections.find((item) => item.id === id)
    if (!request || !['pending', 'accepted'].includes(request.status) || actionId) return

    invalidateDeepLinkNavigation()
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

    invalidateDeepLinkNavigation()
    confirmationTriggerRef.current = document.activeElement
    setConfirmation({
      kind: 'connection',
      id,
      title: 'Hủy lời mời kết nối?',
      message: `Lời mời gửi cho ${connection.name} sẽ được hủy.`,
      actionLabel: 'Hủy lời mời',
    })
  }

  function disconnectConnection(id) {
    const connection = connections.find((item) => item.id === id)
    if (!connection) return

    invalidateDeepLinkNavigation()
    confirmationTriggerRef.current = document.activeElement
    setConfirmation({
      kind: 'connection',
      id,
      title: 'Ngắt kết nối?',
      message: `Cậu và ${connection.name} sẽ không còn ở trạng thái kết nối. Lịch sử tin nhắn vẫn được giữ lại.`,
      actionLabel: 'Ngắt kết nối',
    })
  }

  function closeConfirmation() {
    setConfirmation(null)
    focusAfterConfirmation()
  }

  async function confirmAction() {
    if (!confirmation) return

    const { kind, id, nextStatus } = confirmation
    setConfirmation(null)

    if (kind === 'plan') {
      await updatePlanStatus(id, nextStatus)
    } else {
      await updateRequest(id, 'cancelled')
    }

    focusAfterConfirmation()
  }

  function openPlanDialog(connectionId) {
    const connection = connections.find(
      (item) => item.id === connectionId && item.status === 'accepted'
    )
    if (!connection || isSavingPlan) return

    invalidateDeepLinkNavigation()
    planDialogTriggerRef.current = document.activeElement
    setPlanDraft({
      ...EMPTY_COCO_PLAN_DRAFT,
      startsAt: getDefaultCocoPlanStartAt(),
    })
    setPlanErrors({})
    setPlanValidationAttempt(0)
    setPlanSubmitError('')
    planDialogConnectionIdRef.current = connectionId
    setPlanDialogConnectionId(connectionId)
  }

  function closePlanDialog() {
    if (isSavingPlan) return

    invalidateDeepLinkNavigation()
    planDialogConnectionIdRef.current = null
    setPlanDialogConnectionId(null)
    setPlanErrors({})
    setPlanValidationAttempt(0)
    setPlanSubmitError('')
    window.requestAnimationFrame(() => {
      planDialogTriggerRef.current?.focus({ preventScroll: true })
    })
  }

  function changePlanDraft(field, value) {
    setPlanDraft((current) => ({ ...current, [field]: value }))
    setPlanErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setPlanSubmitError('')
  }

  async function submitPlan(event) {
    event.preventDefault()

    const userId = messageUserIdRef.current
    const connection = planDialogConnection
    const validationErrors = getCocoPlanDraftErrors(planDraft)

    if (Object.keys(validationErrors).length > 0) {
      setPlanErrors(validationErrors)
      setPlanValidationAttempt((current) => current + 1)
      setPlanSubmitError('Hãy kiểm tra lại các trường được đánh dấu.')
      return
    }

    if (!connection || !userId || isSavingPlan) return

    setIsSavingPlan(true)
    setPlanSubmitError('')

    try {
      const { data: insertedPlan, error: insertError } = await supabase
        .from('connection_plans')
        .insert(buildCocoPlanInsert(planDraft, {
          connectionRequestId: connection.id,
          proposerId: userId,
        }))
        .select(`
          id,
          connection_request_id,
          proposer_id,
          title,
          starts_at,
          mode,
          location_note,
          status,
          created_at,
          updated_at
        `)
        .single()

      if (insertError) throw insertError

      const plan = mapCocoPlan(insertedPlan, userId)
      setConnections((current) => current.map((item) => (
        item.id === connection.id ? { ...item, plan } : item
      )))
      setLinkedPlan(null)
      setLinkedPlanConnectionId(null)
      planDialogConnectionIdRef.current = null
      setPlanDialogConnectionId(null)
      setPlanErrors({})
      setStatusMessage(`Đã gửi Coco Plan cho ${connection.name}.`)
      window.requestAnimationFrame(() => {
        planPanelHeadingRef.current?.focus({ preventScroll: true })
      })
    } catch (planError) {
      setPlanSubmitError(getPlanErrorMessage(planError))
    } finally {
      setIsSavingPlan(false)
    }
  }

  async function updatePlanStatus(planId, status, plan = null) {
    if (planAction) return

    if (status === 'completed' && !canCompleteCocoPlan(plan)) {
      setStatusMessage('')
      setError('Chưa thể đánh dấu hoàn thành trước thời gian bắt đầu của Coco Plan.')
      window.requestAnimationFrame(() => {
        planPanelHeadingRef.current?.focus({ preventScroll: true })
      })
      return
    }

    const userId = messageUserIdRef.current
    if (!userId) return

    setPlanAction({ id: planId, status })
    setError('')

    try {
      const { data: updatedPlan, error: updateError } = await supabase
        .from('connection_plans')
        .update({ status })
        .eq('id', planId)
        .select(`
          id,
          connection_request_id,
          proposer_id,
          title,
          starts_at,
          mode,
          location_note,
          status,
          created_at,
          updated_at
        `)
        .single()

      if (updateError) throw updateError
      if (updatedPlan.status !== status) {
        throw new Error('Connection plan status was not updated')
      }

      const plan = mapCocoPlan(updatedPlan, userId)
      setConnections((current) => current.map((item) => (
        item.id === plan.connectionRequestId ? { ...item, plan } : item
      )))
      setLinkedPlan((current) => current?.id === plan.id ? plan : current)

      const successMessages = {
        accepted: 'Đã chấp nhận Coco Plan.',
        declined: 'Đã từ chối Coco Plan.',
        cancelled: 'Đã hủy Coco Plan.',
        completed: 'Đã đánh dấu Coco Plan hoàn thành.',
      }
      setStatusMessage(successMessages[status] || 'Coco Plan đã được cập nhật.')
      window.requestAnimationFrame(() => {
        planPanelHeadingRef.current?.focus({ preventScroll: true })
      })
    } catch (planError) {
      setError(getPlanErrorMessage(planError))
    } finally {
      setPlanAction(null)
    }
  }

  function requestPlanStatus(plan, status) {
    invalidateDeepLinkNavigation()

    if (status !== 'cancelled') {
      void updatePlanStatus(plan.id, status, plan)
      return
    }

    confirmationTriggerRef.current = document.activeElement
    setConfirmation({
      kind: 'plan',
      id: plan.id,
      nextStatus: status,
      title: 'Hủy Coco Plan?',
      message: 'Kế hoạch sẽ khép lại, nhưng hai cậu vẫn giữ kết nối và có thể đề xuất kế hoạch mới.',
      actionLabel: 'Hủy kế hoạch',
    })
  }

  async function loadOlderMessages(id) {
    const userId = messageUserIdRef.current
    const connection = connections.find((item) => item.id === id)
    const oldestMessage = connection?.messages[0]

    if (!userId || !connection?.hasOlderMessages || !oldestMessage || loadingOlderId) {
      return
    }

    invalidateDeepLinkNavigation()
    const messageList = messageListRef.current
    const previousScrollHeight = messageList?.scrollHeight || 0
    const previousScrollTop = messageList?.scrollTop || 0

    setLoadingOlderId(id)
    setError('')

    try {
      const page = await fetchMessagePage(id, userId, oldestMessage)

      setConnections((current) => current.map((item) => (
        item.id === id
          ? {
              ...item,
              messages: mergeMessages(page.messages, item.messages),
              hasOlderMessages: page.hasOlder,
            }
          : item
      )))

      window.requestAnimationFrame(() => {
        const currentList = messageListRef.current
        if (!currentList || activeChatIdRef.current !== id) return

        currentList.scrollTop = previousScrollTop
          + currentList.scrollHeight
          - previousScrollHeight
      })
    } catch {
      setError('Chưa tải được tin nhắn cũ hơn. Hãy thử lại.')
    } finally {
      setLoadingOlderId(null)
    }
  }

  function openChat(id) {
    invalidateDeepLinkNavigation()
    stopLocalTyping()
    lastChatTriggerRef.current = document.activeElement
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    shouldFocusChatRef.current = window.matchMedia('(max-width: 760px)').matches
    chatFocusGenerationRef.current = null
    activeChatIdRef.current = id
    setChatId(id)
    setDraft('')
    setLinkedPlan(null)
    setLinkedPlanConnectionId(null)
    void markConversationRead(id)
  }

  function closeChat() {
    invalidateDeepLinkNavigation()
    clearChatState({ restoreFocus: true })
  }

  function selectMatchesTab(nextTab) {
    invalidateDeepLinkNavigation()
    setTab(nextTab)
    clearChatState()
  }

  async function sendMessage(event) {
    event.preventDefault()

    const text = draft.trim()
    const userId = messageUserIdRef.current
    if (!text || !chat || !userId || isSendingMessage) return

    invalidateDeepLinkNavigation()
    stopLocalTyping()
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
        .select('id, connection_request_id, sender_id, body, created_at, read_at')
        .single()

      if (insertError) throw insertError

      const message = mapMessage(insertedMessage, userId)
      setConnections((current) => current.map((item) =>
        item.id === connectionRequestId
          ? { ...item, messages: mergeMessages(item.messages, [message]) }
          : item
      ))
      setDraft('')
      window.requestAnimationFrame(() => {
        const messageList = messageListRef.current
        if (messageList) messageList.scrollTop = messageList.scrollHeight
      })
    } catch (sendError) {
      setError(getMessageErrorMessage(sendError))
    } finally {
      setIsSendingMessage(false)
    }
  }

  function handleComposerKeyDown(event) {
    const submitShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter'
    if (!submitShortcut || event.altKey || event.shiftKey || event.nativeEvent.isComposing) return

    event.preventDefault()
    if (!draft.trim() || isSendingMessage) return
    event.currentTarget.form?.requestSubmit()
  }

  function handleBlocked(profileId, name) {
    invalidateDeepLinkNavigation()

    const blockedConnectionIds = connections
      .filter((item) => item.profileId === profileId)
      .map((item) => item.id)

    setConnections((current) => current.filter((item) => item.profileId !== profileId))
    if (chatId && blockedConnectionIds.includes(chatId)) {
      stopLocalTyping()
      clearRemoteTyping()
      activeChatIdRef.current = null
      setChatId(null)
      setDraft('')
      planDialogConnectionIdRef.current = null
      setPlanDialogConnectionId(null)
    }
    setStatusMessage(`Đã chặn ${name}. Kết nối và tin nhắn mới đã được dừng.`)
  }

  function handleReported(_profileId, name) {
    invalidateDeepLinkNavigation()
    setStatusMessage(`Đã gửi báo cáo về ${name}. Nội dung báo cáo được giữ kín.`)
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
          {!loadError && <div className="matches-summary-stats">
            <span><strong>{pendingCount}</strong> đang chờ</span>
            <span><strong>{acceptedCount}</strong> đã kết nối</span>
            <span aria-live="polite"><strong>{totalUnreadCount}</strong> chưa đọc</span>
          </div>}
        </div>

        {error && !loadError && (
          <div className="form-error-banner" role="alert">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="matches-status-message" role="status" aria-live="polite">
            <Icon name="connection" /> {statusMessage}
          </div>
        )}

        {isLoading && !loadError && (
          <div className="form-error-banner" role="status" aria-live="polite">
            Đang tải lời mời kết nối…
          </div>
        )}

        {loadError && !isLoading && (
          <DataRecoveryState
            title="Chưa tải được không gian kết nối"
            message={`${loadError} Dữ liệu không bị xóa; Coco chỉ tạm dừng hiển thị để tránh báo trạng thái sai.`}
            onRetry={retryConnections}
            isRetrying={isLoading}
          />
        )}

        {planDialogConnection && (
          <CocoPlanDialog
            connectionName={planDialogConnection.name}
            draft={planDraft}
            errors={planErrors}
            validationAttempt={planValidationAttempt}
            submitError={planSubmitError}
            isSaving={isSavingPlan}
            onChange={changePlanDraft}
            onClose={closePlanDialog}
            onSubmit={submitPlan}
          />
        )}

        {confirmation && (
          <div className="discover-dialog-backdrop" role="presentation">
            <section
              ref={confirmationDialogRef}
              className="discover-profile-dialog connection-confirmation-dialog"
              role="alertdialog"
              tabIndex="-1"
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
                  autoFocus
                  disabled={confirmationIsBusy}
                  onClick={closeConfirmation}
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  className="connect-student-button"
                  disabled={confirmationIsBusy}
                  onClick={confirmAction}
                >
                  {confirmationIsBusy ? 'Đang cập nhật…' : confirmation.actionLabel}
                </button>
              </footer>
            </section>
          </div>
        )}

        {!loadError && (
          <>
            <div className="purpose-tabs matches-tabs" role="tablist" aria-label="Trạng thái kết nối">
              <button
            type="button"
            className={tab === 'pending' ? 'active' : ''}
            id="pending-tab"
            role="tab"
            aria-selected={tab === 'pending'}
            aria-controls="matches-panel"
            onClick={() => selectMatchesTab('pending')}
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
            onClick={() => selectMatchesTab('accepted')}
          >
            Đã kết nối ({acceptedCount})
              </button>
            </div>

        {!isLoading && (
          (tab === 'pending' && visibleConnections.length === 0)
          || (tab === 'accepted' && acceptedConnections.length === 0)
        ) ? (
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

              <div className="conversation-filters" role="search" aria-label="Lọc cuộc trò chuyện">
                <label className="conversation-search-field">
                  <span>Tìm cuộc trò chuyện</span>
                  <input
                    type="search"
                    value={conversationQuery}
                    onChange={(event) => setConversationQuery(event.target.value)}
                    placeholder="Tên, ngành, mục tiêu…"
                    autoComplete="off"
                  />
                </label>
                <div className="conversation-filter-row">
                  <button
                    type="button"
                    className={showUnreadOnly ? 'is-active' : ''}
                    aria-pressed={showUnreadOnly}
                    onClick={() => setShowUnreadOnly((current) => !current)}
                  >
                    Chưa đọc
                    {totalUnreadCount > 0 && (
                      <span aria-label={`${totalUnreadCount} tin nhắn chưa đọc`}>
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </span>
                    )}
                  </button>
                  <small aria-live="polite">
                    {filteredAcceptedConnections.length}/{acceptedConnections.length} hội thoại
                  </small>
                </div>
              </div>

              <div className="conversation-list-items">
                {filteredAcceptedConnections.length === 0 && (
                  <div className="conversation-filter-empty" role="status">
                    <strong>Không tìm thấy hội thoại phù hợp</strong>
                    <p>Thử từ khóa khác hoặc hiển thị lại tất cả cuộc trò chuyện.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setConversationQuery('')
                        setShowUnreadOnly(false)
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                )}

                {filteredAcceptedConnections.map((item) => {
                  const lastMessage = item.messages[item.messages.length - 1]
                  const unreadCount = getUnreadMessageCount(item)
                  const activityDate = getConversationActivityDate(item)
                  const activityLabel = formatConversationActivityTime(item)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`conversation-item ${chatId === item.id ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
                      aria-pressed={chatId === item.id}
                      aria-label={`${item.name}${unreadCount > 0 ? `, ${unreadCount} tin nhắn chưa đọc` : ''}`}
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
                      <span className="conversation-item-meta">
                        {activityDate && activityLabel && (
                          <time dateTime={activityDate.toISOString()}>{activityLabel}</time>
                        )}
                        {unreadCount > 0 && (
                          <span className="conversation-unread-badge" aria-hidden="true">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
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
                      <TrustBadge profile={chat} compact />
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
                  {chat.profileId && (
                    <SafetyActions
                      targetId={chat.profileId}
                      targetName={chat.name}
                      connectionRequestId={chat.id}
                      messageId={chat.messages.filter((message) => message.sender === 'other').at(-1)?.id || null}
                      onBlocked={handleBlocked}
                      onReported={handleReported}
                      compact
                    />
                  )}
                </header>

                <CocoPlanCard
                  plan={displayedPlan}
                  connectionName={chat.name}
                  headingRef={planPanelHeadingRef}
                  hasNewerActivePlan={hasNewerActivePlan}
                  pendingStatus={
                    planAction && planAction.id === displayedPlan?.id
                      ? planAction.status
                      : null
                  }
                  onCreate={() => openPlanDialog(chat.id)}
                  onShowCurrent={() => {
                    invalidateDeepLinkNavigation()
                    setLinkedPlan(null)
                    setLinkedPlanConnectionId(null)
                    window.requestAnimationFrame(() => {
                      planPanelHeadingRef.current?.focus({ preventScroll: true })
                    })
                  }}
                  onUpdateStatus={(status) => requestPlanStatus(displayedPlan, status)}
                />

                <div
                  ref={messageListRef}
                  className="chat-message-list"
                  role="log"
                  aria-label={`Tin nhắn với ${chat.name}`}
                  aria-live="polite"
                >
                  {chat.hasOlderMessages && (
                    <div className="chat-history-loader">
                      <button
                        type="button"
                        onClick={() => loadOlderMessages(chat.id)}
                        disabled={loadingOlderId === chat.id}
                        aria-busy={loadingOlderId === chat.id}
                      >
                        {loadingOlderId === chat.id
                          ? 'Đang tải tin nhắn cũ…'
                          : 'Tải tin nhắn cũ hơn'}
                      </button>
                    </div>
                  )}

                  {chat.messages.length === 0 && (
                    <div className="chat-empty-context">
                      {chat.introMessage && (
                        <blockquote>
                          <span>Lời nhắn khi kết nối</span>
                          <p>{chat.introMessage}</p>
                        </blockquote>
                      )}
                      <p className="chat-empty-message">Chưa có tin nhắn. Hãy tiếp tục từ lý do hai cậu đã kết nối.</p>
                    </div>
                  )}

                  {chat.messages.map((message) => {
                    const deliveryLabel = getMessageDeliveryLabel(
                      message,
                      latestOwnMessageId
                    )
                    const timestampLabel = formatMessageTimestamp(message.createdAt)

                    return (
                      <article
                        key={message.id}
                        className={`chat-message ${message.sender === 'me' ? 'from-me' : 'from-other'}`}
                        aria-label={`Tin nhắn của ${message.sender === 'me' ? 'cậu' : chat.name}`}
                      >
                        <strong aria-hidden="true">
                          {message.sender === 'me' ? 'Cậu' : chat.name}
                        </strong>
                        <div>{message.text}</div>
                        <footer className="chat-message-meta">
                          {timestampLabel && (
                            <time dateTime={message.createdAt}>{timestampLabel}</time>
                          )}
                          {deliveryLabel && (
                            <span className="chat-delivery-status">
                              {deliveryLabel}
                            </span>
                          )}
                        </footer>
                      </article>
                    )
                  })}
                </div>

                <div className="chat-typing-region" aria-live="polite" aria-atomic="true">
                  {typingConnectionId === chat.id && (
                    <span className="chat-typing-status">
                      <span className="chat-typing-dots" aria-hidden="true"><i /><i /><i /></span>
                      {chat.name} đang nhập…
                    </span>
                  )}
                </div>

                <form className="chat-composer" onSubmit={sendMessage}>
                  <label className="profile-field">
                    <span>Tin nhắn</span>
                    <textarea
                      value={draft}
                      onChange={(event) => {
                        invalidateDeepLinkNavigation()
                        const nextDraft = event.target.value
                        setDraft(nextDraft)

                        if (!nextDraft.trim()) {
                          stopLocalTyping()
                          return
                        }

                        sendTypingState(true)
                        if (typingIdleTimerRef.current) {
                          window.clearTimeout(typingIdleTimerRef.current)
                        }
                        typingIdleTimerRef.current = window.setTimeout(
                          stopLocalTyping,
                          TYPING_IDLE_MS
                        )
                      }}
                      placeholder="Nhập lời chào..."
                      maxLength={1000}
                      aria-describedby="chat-composer-hint chat-composer-count"
                      onKeyDown={handleComposerKeyDown}
                      required
                    />
                    <div className="chat-composer-meta">
                      <span id="chat-composer-hint">Ctrl/Cmd + Enter để gửi · Enter để xuống dòng</span>
                      <span id="chat-composer-count">{draft.length}/1000</span>
                    </div>
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
              <article
                className="discover-student-card connection-card"
                key={item.id}
                ref={(card) => {
                  if (card) {
                    pendingConnectionCardRefs.current.set(item.id, card)
                  } else {
                    pendingConnectionCardRefs.current.delete(item.id)
                  }
                }}
                tabIndex="-1"
                aria-labelledby={`connection-card-title-${item.id}`}
              >
                <div className="discover-avatar">
                  {item.name.trim().split(/\s+/).pop()?.[0] || '?'}
                </div>

                <div className="student-main-info">
                  <h2 id={`connection-card-title-${item.id}`}>{item.name}</h2>
                  <p>{item.major}</p>
                  <TrustBadge profile={item} compact />
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

                {item.introMessage && (
                  <blockquote className="connection-intro-card">
                    <span>{item.isIncoming ? 'Lời nhắn gửi cậu' : 'Lời nhắn đã gửi'}</span>
                    <p>{item.introMessage}</p>
                  </blockquote>
                )}

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
                  {item.profileId && (
                    <SafetyActions
                      targetId={item.profileId}
                      targetName={item.name}
                      connectionRequestId={item.id}
                      onBlocked={handleBlocked}
                      onReported={handleReported}
                      compact
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
            )}
          </>
        )}

      </section>
    </AppLayout>
  )
}
