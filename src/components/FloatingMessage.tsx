import { useEffect } from 'react';

interface FloatingMessageProps {
  tone: 'status' | 'error';
  message: string;
  onDismiss: () => void;
}

export function FloatingMessage({ tone, message, onDismiss }: FloatingMessageProps) {
  useEffect(() => {
    if (tone !== 'status') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, tone, message]);

  return (
    <div
      className={`floating-message ${tone === 'error' ? 'error-message' : 'status-message'}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <div className="floating-message-body">
        <span className="floating-message-icon" aria-hidden="true">
          {tone === 'error' ? '!' : 'i'}
        </span>
        <p className="floating-message-text">{message}</p>
      </div>
      <button
        type="button"
        className="floating-message-close"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        x
      </button>
    </div>
  );
}
