import { Modal } from './Modal'
import { useLocale } from '../../hooks/useLocale'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { locale } = useLocale()
  const isRu = locale === 'ru'

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="ghost-action" onClick={onCancel} disabled={loading}>
            {cancelLabel === 'Cancel' ? (isRu ? 'Отмена' : 'Cancel') : cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'danger-action' : 'primary-action'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (isRu ? 'Выполняем...' : 'Working...') : confirmLabel === 'Confirm' ? (isRu ? 'Подтвердить' : 'Confirm') : confirmLabel}
          </button>
        </>
      }
    />
  )
}
