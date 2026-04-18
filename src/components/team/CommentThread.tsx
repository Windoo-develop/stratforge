import { useState } from 'react'
import { UserAvatar } from '../ui/UserAvatar'
import { useLocale } from '../../hooks/useLocale'
import type { LineupComment, StratComment } from '../../types/domain'

type TeamComment = LineupComment | StratComment

type CommentThreadProps = {
  title?: string
  comments: TeamComment[]
  loading?: boolean
  currentUserId: string
  canModerate: boolean
  placeholder?: string
  submitLabel?: string
  onSubmit: (body: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

export function CommentThread({
  title = 'Comments',
  comments,
  loading = false,
  currentUserId,
  canModerate,
  placeholder = 'Add a comment for your team...',
  submitLabel = 'Post comment',
  onSubmit,
  onDelete,
}: CommentThreadProps) {
  const { locale, formatDateTime } = useLocale()
  const isRu = locale === 'ru'
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSubmit = async () => {
    const body = draft.trim()
    if (!body || submitting) return

    setSubmitting(true)

    try {
      await onSubmit(body)
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (deletingId) return

    setDeletingId(commentId)

    try {
      await onDelete(commentId)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="comment-thread">
      <div className="comment-thread-header">
        <h4>{title}</h4>
        <span>{comments.length} {isRu ? 'всего' : 'total'}</span>
      </div>

      <div className="comment-compose">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={500}
        />
        <div className="comment-compose-footer">
          <span className="muted-label">{draft.length}/500</span>
          <button
            type="button"
            className="primary-action"
            onClick={() => void handleSubmit()}
            disabled={submitting || !draft.trim() || loading}
          >
            {submitting ? (isRu ? 'Публикуем...' : 'Posting...') : submitLabel}
          </button>
        </div>
      </div>

      <div className="comment-list">
        {loading ? (
          <div className="comment-empty">{isRu ? 'Загружаем комментарии...' : 'Loading comments...'}</div>
        ) : comments.length ? (
          comments.map((comment) => {
            const canDelete = canModerate || comment.author_id === currentUserId

            return (
              <article key={comment.id} className="comment-card">
                <div className="comment-card-header">
                  <div className="comment-author">
                    <UserAvatar
                      username={comment.author?.username ?? (isRu ? 'Неизвестно' : 'Unknown')}
                      avatarUrl={comment.author?.avatar_url}
                      size="sm"
                    />
                    <div>
                      <strong>{comment.author?.username ?? (isRu ? 'Неизвестный игрок' : 'Unknown player')}</strong>
                      <span>{formatDateTime(comment.created_at)}</span>
                    </div>
                  </div>

                  {canDelete ? (
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() => void handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                    >
                      {deletingId === comment.id ? (isRu ? 'Удаляем...' : 'Deleting...') : isRu ? 'Удалить' : 'Delete'}
                    </button>
                  ) : null}
                </div>

                <p>{comment.body}</p>
              </article>
            )
          })
        ) : (
          <div className="comment-empty">
            {isRu ? 'Комментариев пока нет. Начните обсуждение здесь.' : 'No comments yet. Start the discussion here.'}
          </div>
        )}
      </div>
    </section>
  )
}
