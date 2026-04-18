import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupportConversationList } from '../components/support/SupportConversationList'
import { SupportMessageThread } from '../components/support/SupportMessageThread'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../hooks/useLocale'
import { useToast } from '../contexts/ToastContext'
import { getErrorMessage } from '../lib/errors'
import { fetchAdvancedRegistrationRequests, reviewAdvancedRegistrationRequest } from '../lib/adminApi'
import {
  fetchSupportInbox,
  fetchSupportMessages,
  sendSupportMessage,
  updateSupportConversationStatus,
} from '../lib/supportApi'
import type { AdvancedRegistrationRequest, AdvancedRegistrationRequestStatus, SupportConversation, SupportMessage } from '../types/domain'

function AdvancedRegistrationReviewCard({
  request,
  onUpdated,
}: {
  request: AdvancedRegistrationRequest
  onUpdated: () => Promise<void>
}) {
  const { t, formatDateTime } = useLocale()
  const { pushToast } = useToast()
  const [notes, setNotes] = useState(request.admin_notes ?? '')
  const [savingStatus, setSavingStatus] = useState<AdvancedRegistrationRequestStatus | null>(null)

  useEffect(() => {
    setNotes(request.admin_notes ?? '')
  }, [request.admin_notes, request.id])

  const applyStatus = async (status: AdvancedRegistrationRequestStatus) => {
    setSavingStatus(status)

    try {
      await reviewAdvancedRegistrationRequest({
        requestId: request.id,
        status,
        adminNotes: notes,
      })
      pushToast({
        tone: 'success',
        title: t('admin.reviewRequestUpdated'),
        message: t('admin.reviewRequestMovedHint', { status }),
      })
      await onUpdated()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('admin.reviewRequestFailed'),
        message: getErrorMessage(error),
      })
    } finally {
      setSavingStatus(null)
    }
  }

  return (
    <article className="registration-review-card">
      <div className="registration-review-header">
        <div>
          <strong>{request.email}</strong>
          <span>
            {formatDateTime(request.created_at)}
            {request.user ? ` · ${request.user.username}` : ''}
          </span>
        </div>
        <span className={`support-status-pill status-${request.status}`}>{request.status}</span>
      </div>

      <div className="registration-review-payload">
        <div className="registration-review-details">
          <div>
            <span className="muted-label">Standoff 2 ID</span>
            <strong>{request.payload.standoff_player_id || t('admin.notProvided')}</strong>
          </div>

          {request.payload.stats_screenshot_url ? (
            <a href={request.payload.stats_screenshot_url} target="_blank" rel="noreferrer" className="ghost-action">
              {t('admin.openStatsScreenshot')}
            </a>
          ) : (
            <span className="muted-label">{t('admin.noScreenshotUploaded')}</span>
          )}
        </div>

        {request.payload.stats_screenshot_url ? (
          <img
            src={request.payload.stats_screenshot_url}
            alt="Advanced registration stats screenshot"
            className="registration-review-image"
          />
        ) : null}
      </div>

      <label>
        {t('admin.adminNotes')}
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t('admin.adminNotesPlaceholder')}
        />
      </label>

      <div className="inline-actions">
        {(['pending', 'approved', 'rejected'] as AdvancedRegistrationRequestStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            className={status === 'approved' ? 'primary-action' : status === 'rejected' ? 'danger-action' : 'ghost-action'}
            disabled={Boolean(savingStatus)}
            onClick={() => void applyStatus(status)}
          >
            {savingStatus === status ? t('admin.saving') : status}
          </button>
        ))}
      </div>
    </article>
  )
}

export function AdminPage() {
  const { profile } = useAuth()
  const { t, formatDateTime } = useLocale()
  const { pushToast } = useToast()
  const [activeTab, setActiveTab] = useState<'registrations' | 'support'>('support')
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [requests, setRequests] = useState<AdvancedRegistrationRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  const refreshInbox = useCallback(async (nextSelectedId?: string | null) => {
    setLoadingInbox(true)

    try {
      const inbox = await fetchSupportInbox()
      setConversations(inbox)
      setSelectedConversationId((current) => {
        const preferredId = nextSelectedId ?? current
        const preferredExists = preferredId ? inbox.some((item) => item.id === preferredId) : false
        return preferredExists ? preferredId : (inbox[0]?.id ?? null)
      })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('admin.loadingSupportInbox'),
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingInbox(false)
    }
  }, [pushToast])

  const refreshMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)

    try {
      setMessages(await fetchSupportMessages(conversationId))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('admin.loadingSupportThread'),
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingMessages(false)
    }
  }, [pushToast])

  const refreshRequests = useCallback(async () => {
    setLoadingRequests(true)

    try {
      setRequests(await fetchAdvancedRegistrationRequests('pending'))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('admin.loadingRegistrationQueue'),
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingRequests(false)
    }
  }, [pushToast])

  useEffect(() => {
    void Promise.all([refreshInbox(), refreshRequests()])
  }, [refreshInbox, refreshRequests])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    void refreshMessages(selectedConversationId)
  }, [refreshMessages, selectedConversationId])

  const sendReply = async () => {
    if (!profile || !selectedConversation || !reply.trim() || selectedConversation.status === 'closed') return

    setSendingReply(true)

    try {
      await sendSupportMessage({
        conversationId: selectedConversation.id,
        authorId: profile.id,
        body: reply,
        isAdmin: true,
      })
      setReply('')
      await Promise.all([
        refreshMessages(selectedConversation.id),
        refreshInbox(selectedConversation.id),
      ])
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('admin.sendReplyFailed'),
        message: getErrorMessage(error),
      })
    } finally {
      setSendingReply(false)
    }
  }

  const updateStatus = async (status: SupportConversation['status']) => {
    if (!selectedConversation) return

    try {
      await updateSupportConversationStatus(selectedConversation.id, status)
      pushToast({
        tone: 'success',
        title: t('admin.threadStatusUpdated'),
        message: status === 'closed'
          ? t('admin.threadClosedHint')
          : t('admin.threadMovedHint', { status }),
      })
      await refreshInbox(selectedConversation.id)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('admin.loadingSupportThread'),
        message: getErrorMessage(error),
      })
    }
  }

  if (!profile) {
    return <section className="page-shell">{t('admin.loadingWorkspace')}</section>
  }

  return (
    <section className="page-shell admin-page">
      <div className="support-page-header team-hub-panel">
        <div>
          <p className="eyebrow">{t('nav.admin')}</p>
          <h1>{t('admin.title')}</h1>
          <span className="hero-text">{t('admin.subtitle')}</span>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`filter-chip ${activeTab === 'support' ? 'active' : ''}`}
            onClick={() => setActiveTab('support')}
          >
            {t('admin.supportInbox')}
          </button>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrations')}
          >
            {t('admin.advancedRegistration')}
          </button>
        </div>
      </div>

      {activeTab === 'support' ? (
        <div className="support-workspace admin-workspace">
          <SupportConversationList
            conversations={conversations}
            activeConversationId={selectedConversationId}
            title={loadingInbox ? t('common.loading') : t('admin.supportInbox')}
            emptyMessage={t('admin.supportInboxEmpty')}
            onSelect={(conversation) => setSelectedConversationId(conversation.id)}
            renderMeta={(conversation) =>
              `${conversation.user?.username ?? t('admin.unknownUser')} · ${formatDateTime(conversation.updated_at)}`
            }
          />

          <SupportMessageThread
            conversation={selectedConversation}
            messages={messages}
            currentUserId={profile?.id ?? ''}
            loading={sendingReply || loadingMessages}
            composerValue={reply}
            composerPlaceholder={selectedConversation?.status === 'closed' ? t('admin.replyPlaceholderClosed') : t('admin.replyPlaceholderOpen')}
            composerDisabled={!selectedConversation || selectedConversation.status === 'closed'}
            headerActions={
              selectedConversation ? (
                <div className="chip-row">
                  {(['open', 'pending', 'closed'] as SupportConversation['status'][]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`filter-chip ${selectedConversation.status === status ? 'active' : ''}`}
                      onClick={() => void updateStatus(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              ) : null
            }
            onComposerChange={setReply}
            onSend={sendReply}
          />
        </div>
      ) : null}

      {activeTab === 'registrations' ? (
        <div className="team-hub-panel">
          <div className="map-library-header">
            <div>
              <p className="eyebrow">{t('admin.advancedRegistration')}</p>
              <h3>{t('admin.reviewQueue')}</h3>
            </div>
          </div>

          {loadingRequests ? (
            <div className="empty-panel">
              <strong>{t('admin.loadingRequests')}</strong>
            </div>
          ) : requests.length ? (
            <div className="registration-review-list">
              {requests.map((request) => (
                <AdvancedRegistrationReviewCard
                  key={request.id}
                  request={request}
                  onUpdated={refreshRequests}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              <strong>{t('admin.pendingRequestsEmpty')}</strong>
              <span>{t('admin.pendingRequestsHint')}</span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
