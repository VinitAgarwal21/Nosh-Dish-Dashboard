import React from 'react';

/**
 * ErrorBanner component for inline card errors, conflict warnings,
 * external update notifications, and full-page errors.
 */
export function ErrorBanner({
  variant = 'error', // 'error' | 'conflict' | 'info' | 'fullpage'
  title,
  message,
  details,
  actionText,
  onAction,
}) {
  if (variant === 'fullpage') {
    return (
      <div className="fullpage-error">
        <div className="fullpage-error__icon">⚠️</div>
        <h2 className="fullpage-error__title">{title || 'Unable to Load Dashboard'}</h2>
        <p className="fullpage-error__message">{message || 'Could not connect to the backend server.'}</p>
        {onAction && (
          <button type="button" className="btn btn--primary" onClick={onAction}>
            {actionText || 'Retry'}
          </button>
        )}
      </div>
    );
  }

  if (variant === 'conflict') {
    return (
      <div className="banner banner--conflict" role="alert">
        <div className="banner__header">
          <span className="banner__icon">⚠️</span>
          <span className="banner__title">{title || 'Update Conflict'}</span>
        </div>
        <div className="banner__body">
          <p className="banner__message">{message}</p>
        </div>
        {onAction && (
          <div className="banner__actions">
            <button
              type="button"
              className="btn btn--sm btn--warning"
              onClick={onAction}
            >
              {actionText || 'Reload latest (discards my draft)'}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'info') {
    return (
      <div className="banner banner--info" role="status">
        <div className="banner__header">
          <span className="banner__icon">ℹ️</span>
          <span className="banner__title">{title || 'Server Update Available'}</span>
        </div>
        <div className="banner__body">
          <p className="banner__message">{message}</p>
        </div>
        {onAction && (
          <div className="banner__actions">
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={onAction}
            >
              {actionText || 'Reload latest'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Standard inline error banner
  return (
    <div className="banner banner--error" role="alert">
      <div className="banner__header">
        <span className="banner__icon">🛑</span>
        <span className="banner__title">{title || 'Save Failed'}</span>
      </div>
      <div className="banner__body">
        <p className="banner__message">{message}</p>
        {details && Array.isArray(details) && details.length > 0 && (
          <ul className="banner__details-list">
            {details.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ErrorBanner;
