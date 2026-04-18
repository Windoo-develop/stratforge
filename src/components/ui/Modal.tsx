import type { PropsWithChildren, ReactNode } from 'react'
import { useLocale } from '../../hooks/useLocale'

type ModalProps = PropsWithChildren<{
  open: boolean
  title: string
  description?: string
  onClose: () => void
  footer?: ReactNode
  className?: string
  bodyClassName?: string
}>

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  className,
  bodyClassName,
  children,
}: ModalProps) {
  const { locale } = useLocale()

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={className ? `modal-card ${className}` : 'modal-card'} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-heading">
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={locale === 'ru' ? 'Закрыть диалог' : 'Close dialog'}
          >
            ×
          </button>
        </div>

        <div className={bodyClassName ? `modal-body ${bodyClassName}` : 'modal-body'}>{children}</div>

        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
