import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupportConversationList } from '../components/support/SupportConversationList'
import { SupportMessageThread } from '../components/support/SupportMessageThread'
import { useAuth } from '../contexts/AuthContext'
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
        title: 'Registration request updated',
        message: `Request moved to ${status}.`,
      })
      await onUpdated()
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not review request',
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
            {new Date(request.created_at).toLocaleString()}
            {request.user ? ` · ${request.user.username}` : ''}
          </span>
        </div>
        <span className={`support-status-pill status-${request.status}`}>{request.status}</span>
      </div>

      <div className="registration-review-payload">
        <div className="registration-review-details">
          <div>
            <span className="muted-label">Standoff 2 ID</span>
            <strong>{request.payload.standoff_player_id || 'Not provided'}</strong>
          </div>

          {request.payload.stats_screenshot_url ? (
            <a href={request.payload.stats_screenshot_url} target="_blank" rel="noreferrer" className="ghost-action">
              Open stats screenshot
            </a>
          ) : (
            <span className="muted-label">No screenshot uploaded</span>
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
        Admin notes
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Internal notes for the review queue..."
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
            {savingStatus === status ? 'Saving...' : status}
          </button>
        ))}
      </div>
    </article>
  )
}

export function AdminPage() {
  const { profile } = useAuth()
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
        title: 'Could not load support inbox',
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
        title: 'Could not load support thread',
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
        title: 'Could not load registration queue',
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
        title: 'Could not send admin reply',
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
        title: 'Thread status updated',
        message: status === 'closed'
          ? 'Conversation closed and removed from the admin inbox.'
          : `Conversation moved to ${status}.`,
      })
      await refreshInbox(selectedConversation.id)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not update thread status',
        message: getErrorMessage(error),
      })
    }
  }

  if (!profile) {
    return <section className="page-shell">Loading admin workspace...</section>
  }

  return (
    <section className="page-shell admin-page">
      <div className="support-page-header team-hub-panel">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Admin panel</h1>
          <span className="hero-text">Review future advanced registrations and reply to support chat requests from one workspace.</span>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={`filter-chip ${activeTab === 'support' ? 'active' : ''}`}
            onClick={() => setActiveTab('support')}
          >
            Support inbox
          </button>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrations')}
          >
            Advanced registration
          </button>
        </div>
      </div>

      {activeTab === 'support' ? (
        <div className="support-workspace admin-workspace">
          <SupportConversationList
            conversations={conversations}
            activeConversationId={selectedConversationId}
            title={loadingInbox ? 'Loading...' : 'Support inbox'}
            emptyMessage="Open and pending user threads will appear here. Closed threads stay visible only to the user."
            onSelect={(conversation) => setSelectedConversationId(conversation.id)}
            renderMeta={(conversation) =>
              `${conversation.user?.username ?? 'Unknown user'} · ${new Date(conversation.updated_at).toLocaleString()}`
            }
          />

          <SupportMessageThread
            conversation={selectedConversation}
            messages={messages}
            currentUserId={profile?.id ?? ''}
            loading={sendingReply || loadingMessages}
            composerValue={reply}
            composerPlaceholder={selectedConversation?.status === 'closed' ? 'Reopen the thread to send a reply.' : 'Reply as support admin...'}
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
              <p className="eyebrow">Advanced registration</p>
              <h3>Review queue</h3>
            </div>
          </div>

          {loadingRequests ? (
            <div className="empty-panel">
              <strong>Loading registration requests...</strong>
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
              <strong>No advanced registration requests yet</strong>
              <span>All requests are processed. New submissions will appear here only while they are waiting for review.</span>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
