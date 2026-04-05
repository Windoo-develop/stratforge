import type { PropsWithChildren, ReactNode } from 'react'

type ModalProps = PropsWithChildren<{
  open: boolean
  title: string
  description?: string
  onClose: () => void
  footer?: ReactNode
}>

export function Modal({ open, title, description, onClose, footer, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-heading">
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
