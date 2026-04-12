import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/ui/Modal'
import { SupportConversationList } from '../components/support/SupportConversationList'
import { SupportMessageThread } from '../components/support/SupportMessageThread'
import { useAuth } from '../contexts/AuthContext'
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
        title: 'Could not load support conversations',
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
        title: 'Could not load support messages',
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
        title: 'Support thread created',
        message: 'Your message is in the queue. You can continue the conversation here.',
      })
      setNewTicketOpen(false)
      setNewTicketSubject('')
      setNewTicketBody('')
      await refreshConversations(conversationId)
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Could not open support thread',
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
        title: 'Could not send support message',
        message: getErrorMessage(error),
      })
    } finally {
      setSending(false)
    }
  }

  if (!profile) {
    return <section className="page-shell">Loading support workspace...</section>
  }

  return (
    <section className="page-shell support-page">
      <div className="support-page-header team-hub-panel">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Support chat</h1>
          <span className="hero-text">Open a private thread with the StratForge team and keep all support replies in one place.</span>
        </div>

        <div className="inline-actions">
          <button type="button" className="primary-action" onClick={() => setNewTicketOpen(true)}>
            New support thread
          </button>
        </div>
      </div>

      <div className="support-workspace">
        <SupportConversationList
          conversations={conversations}
          activeConversationId={selectedConversationId}
          title={loadingConversations ? 'Loading...' : 'Your threads'}
          emptyMessage="Start your first thread to contact support."
          onSelect={(conversation) => setSelectedConversationId(conversation.id)}
        />

        <SupportMessageThread
          conversation={selectedConversation}
          messages={messages}
          currentUserId={profile?.id ?? ''}
          loading={sending || loadingMessages}
          composerValue={composer}
          composerPlaceholder={selectedConversation?.status === 'closed' ? 'This thread is closed.' : 'Describe the issue, question, or request in detail...'}
          composerDisabled={!selectedConversation || selectedConversation.status === 'closed'}
          headerActions={
            selectedConversation ? (
              <span className="support-thread-updated">
                Updated {new Date(selectedConversation.updated_at).toLocaleString()}
              </span>
            ) : null
          }
          onComposerChange={setComposer}
          onSend={sendMessage}
        />
      </div>

      <Modal
        open={newTicketOpen}
        title="Start support thread"
        description="Create a private conversation with the StratForge team."
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
            Subject
            <input
              type="text"
              required
              value={newTicketSubject}
              onChange={(event) => setNewTicketSubject(event.target.value)}
              placeholder="Bug report, account question, feature request..."
            />
          </label>

          <label>
            First message
            <textarea
              rows={5}
              required
              value={newTicketBody}
              onChange={(event) => setNewTicketBody(event.target.value)}
              placeholder="Tell support what happened, what you expected, and any steps to reproduce the issue."
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="ghost-action" onClick={() => setNewTicketOpen(false)} disabled={creatingTicket}>
              Cancel
            </button>
            <button type="submit" className="primary-action" disabled={creatingTicket}>
              {creatingTicket ? 'Opening...' : 'Open thread'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
