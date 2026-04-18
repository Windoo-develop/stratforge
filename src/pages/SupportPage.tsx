import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { SupportConversationList } from '../components/support/SupportConversationList'
import { SupportMessageThread } from '../components/support/SupportMessageThread'
import { useAuth } from '../contexts/AuthContext'
import { useLocale } from '../hooks/useLocale'
import { useToast } from '../contexts/ToastContext'
import { getErrorMessage } from '../lib/errors'
import {
  createSupportConversation,
  fetchSupportConversationsForUser,
  fetchSupportMessages,
  sendSupportMessage,
} from '../lib/supportApi'
import type { SupportConversation, SupportMessage } from '../types/domain'

export function SupportPage() {
  const { profile } = useAuth()
  const { t, formatDateTime } = useLocale()
  const { pushToast } = useToast()
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [newTicketSubject, setNewTicketSubject] = useState('')
  const [newTicketBody, setNewTicketBody] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  )

  const refreshConversations = useCallback(async (nextSelectedId?: string | null) => {
    if (!profile) return

    setLoadingConversations(true)

    try {
      const nextConversations = await fetchSupportConversationsForUser(profile.id)
      setConversations(nextConversations)
      setSelectedConversationId((current) => {
        const preferredId = nextSelectedId ?? current
        const preferredExists = preferredId ? nextConversations.some((item) => item.id === preferredId) : false
        return preferredExists ? preferredId : (nextConversations[0]?.id ?? null)
      })
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('support.loadingConversations'),
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingConversations(false)
    }
  }, [profile, pushToast])

  const refreshMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)

    try {
      setMessages(await fetchSupportMessages(conversationId))
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('support.loadingMessages'),
        message: getErrorMessage(error),
      })
    } finally {
      setLoadingMessages(false)
    }
  }, [pushToast])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }

    void refreshMessages(selectedConversationId)
  }, [refreshMessages, selectedConversationId])

  const createTicket = async () => {
    if (!profile) return

    setCreatingTicket(true)

    try {
      const conversationId = await createSupportConversation({
        userId: profile.id,
        subject: newTicketSubject,
        body: newTicketBody,
      })
      pushToast({
        tone: 'success',
        title: t('support.threadCreated'),
        message: t('support.threadCreatedHint'),
      })
      setNewTicketOpen(false)
      setNewTicketSubject('')
      setNewTicketBody('')
      await refreshConversations(conversationId)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('support.threadCreateFailed'),
        message: getErrorMessage(error),
      })
    } finally {
      setCreatingTicket(false)
    }
  }

  const sendMessage = async () => {
    if (!profile || !selectedConversation || !composer.trim() || selectedConversation.status === 'closed') return

    setSending(true)

    try {
      await sendSupportMessage({
        conversationId: selectedConversation.id,
        authorId: profile.id,
        body: composer,
      })
      setComposer('')
      await Promise.all([
        refreshMessages(selectedConversation.id),
        refreshConversations(selectedConversation.id),
      ])
    } catch (error) {
      pushToast({
        tone: 'error',
        title: t('support.sendFailed'),
        message: getErrorMessage(error),
      })
    } finally {
      setSending(false)
    }
  }

  if (!profile) {
    return <section className="page-shell">{t('support.loadingWorkspace')}</section>
  }

  return (
    <section className="page-shell support-page">
      <div className="support-page-header team-hub-panel">
        <div>
          <p className="eyebrow">{t('nav.support')}</p>
          <h1>{t('support.title')}</h1>
          <span className="hero-text">{t('support.subtitle')}</span>
        </div>

        <div className="inline-actions">
          <button type="button" className="primary-action" onClick={() => setNewTicketOpen(true)}>
            {t('support.newThread')}
          </button>
        </div>
      </div>

      <div className="support-workspace">
        <SupportConversationList
          conversations={conversations}
          activeConversationId={selectedConversationId}
          title={loadingConversations ? t('common.loading') : t('support.yourThreads')}
          emptyMessage={t('support.emptyThreads')}
          onSelect={(conversation) => setSelectedConversationId(conversation.id)}
        />

        <SupportMessageThread
          conversation={selectedConversation}
          messages={messages}
          currentUserId={profile?.id ?? ''}
          loading={sending || loadingMessages}
          composerValue={composer}
          composerPlaceholder={selectedConversation?.status === 'closed' ? t('support.closedPlaceholder') : t('support.defaultPlaceholder')}
          composerDisabled={!selectedConversation || selectedConversation.status === 'closed'}
          headerActions={
            selectedConversation ? (
              <span className="support-thread-updated">
                {t('support.updatedAt', { value: formatDateTime(selectedConversation.updated_at) })}
              </span>
            ) : null
          }
          onComposerChange={setComposer}
          onSend={sendMessage}
        />
      </div>

      <Modal
        open={newTicketOpen}
        title={t('support.startThread')}
        description={t('support.startThreadDescription')}
        onClose={() => setNewTicketOpen(false)}
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault()
            void createTicket()
          }}
        >
          <label>
            {t('support.subject')}
            <input
              type="text"
              required
              value={newTicketSubject}
              onChange={(event) => setNewTicketSubject(event.target.value)}
              placeholder={t('support.subjectPlaceholder')}
            />
          </label>

          <label>
            {t('support.firstMessage')}
            <textarea
              rows={5}
              required
              value={newTicketBody}
              onChange={(event) => setNewTicketBody(event.target.value)}
              placeholder={t('support.firstMessagePlaceholder')}
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="ghost-action" onClick={() => setNewTicketOpen(false)} disabled={creatingTicket}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary-action" disabled={creatingTicket}>
              {creatingTicket ? t('support.opening') : t('support.openThread')}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
