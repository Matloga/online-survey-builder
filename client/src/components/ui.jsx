export function Loader({ label = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite">
      <div className="spinner" />
      <p className="muted" style={{ textAlign: 'center' }}>
        {label}
      </p>
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state card">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorAlert({ error, onDismiss }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className="alert alert--error" role="alert">
      {message}
      {onDismiss && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ marginLeft: '0.6rem' }}
          onClick={onDismiss}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export function FieldError({ errors, name }) {
  const msg = errors?.[name];
  if (!msg) return null;
  return <p className="field-error">{msg}</p>;
}

export function StatusBadge({ status }) {
  const labels = { draft: 'Draft', published: 'Live', closed: 'Closed' };
  return (
    <span className={`badge badge--${status}`}>{labels[status] ?? status}</span>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="small muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function Modal({ title, children, onClose, actions }) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="spread">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div style={{ marginTop: '0.75rem' }}>{children}</div>
        {actions && <div className="form-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <p className="stat-card__value">{value}</p>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </div>
  );
}