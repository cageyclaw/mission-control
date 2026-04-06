import { useEffect, useState } from 'react';

interface ChatComposerProps {
  disabled: boolean;
  onSend: (text: string) => Promise<boolean> | boolean;
}

export default function ChatComposer({ disabled, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (disabled) {
      setSending(false);
    }
  }, [disabled]);

  const canSend = !disabled && !sending && draft.trim().length > 0;

  async function submit() {
    if (!canSend) return;
    const text = draft.trim();
    setSending(true);
    try {
      const sent = await onSend(text);
      if (sent) {
        setDraft('');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="occ-chat-composer">
      <textarea
        className="occ-chat-composer__input"
        rows={3}
        value={draft}
        disabled={disabled || sending}
        aria-label="Message input"
        placeholder={disabled ? 'Chat unavailable while disconnected or missing session' : 'Send a message to Q…'}
        onChange={(evt) => setDraft(evt.target.value)}
        maxLength={8000}
        onKeyDown={(evt) => {
          if (evt.nativeEvent.isComposing) return;
          if (evt.key === 'Enter' && !evt.shiftKey) {
            evt.preventDefault();
            void submit();
          }
        }}
      />
      <button
        className="occ-chat-composer__button"
        type="button"
        disabled={!canSend}
        aria-label={sending ? 'Sending message' : 'Send message'}
        onClick={() => void submit()}
      >
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}
