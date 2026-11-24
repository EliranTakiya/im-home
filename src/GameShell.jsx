import './GameShell.css'

export function GameShell({ children, className = '', ...props }) {
  return <div className={`ih-game-shell ${className}`.trim()} {...props}>{children}</div>
}

export function WorkspaceFrame({ children, inspector, footer, className = '', ...props }) {
  return <section className={`ih-workspace-frame ${className}`.trim()} {...props}>
    <div className="ih-workspace-canvas">{children}</div>
    {inspector && <div className="ih-workspace-inspector-slot">{inspector}</div>}
    {footer && <div className="ih-workspace-footer-slot">{footer}</div>}
  </section>
}

export function FloatingInspector({ title, eyebrow, onClose, children, footer, className = '', ...props }) {
  return <aside className={`ih-floating-inspector ${className}`.trim()} aria-label={title} {...props}>
    <header className="ih-inspector-header"><div>{eyebrow && <small>{eyebrow}</small>}<h2>{title}</h2></div>{onClose && <button type="button" className="ih-inspector-close" onClick={onClose} aria-label="סגירה">×</button>}</header>
    <div className="ih-inspector-content">{children}</div>
    {footer && <footer className="ih-inspector-footer">{footer}</footer>}
  </aside>
}

export function ActionFooter({ children, className = '', ...props }) {
  return <footer className={`ih-action-footer ${className}`.trim()} {...props}>{children}</footer>
}

export function MessageLayer({ messages = [], children, className = '', ...props }) {
  const entries = messages.map((message, index) => typeof message === 'string' ? { id: `${message}-${index}`, text: message, type: 'status' } : message)
  if (!entries.length && !children) return null
  return <div className={`ih-message-layer ${className}`.trim()} aria-live="polite" {...props}>
    {entries.map((message) => <div key={message.id} className={`ih-message ih-message-${message.type ?? 'status'}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>)}
    {children}
  </div>
}

export function WideModal({ open = true, title, eyebrow, onClose, children, footer, className = '', ...props }) {
  if (!open) return null
  return <div className="ih-modal-backdrop" role="presentation">
    <section className={`ih-wide-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} {...props}>
      <header className="ih-modal-header"><div>{eyebrow && <small>{eyebrow}</small>}<h2>{title}</h2></div>{onClose && <button type="button" onClick={onClose} aria-label="סגירה">×</button>}</header>
      <div className="ih-modal-content">{children}</div>
      {footer && <footer className="ih-modal-footer">{footer}</footer>}
    </section>
  </div>
}

export function LoadingScreen({ visible = false, message = 'טוענים את המתחם' }) {
  if (!visible) return null
  return <div className="ih-loading-screen" role="status" aria-live="polite">
    <div className="ih-loading-mark" aria-hidden="true">⌂</div>
    <strong>I’M HOME</strong>
    <span>{message}</span>
    <i />
  </div>
}
