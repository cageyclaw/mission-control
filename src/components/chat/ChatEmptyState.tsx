interface ChatEmptyStateProps {
  title: string;
  message: string;
  hint?: string;
}

export default function ChatEmptyState({ title, message, hint }: ChatEmptyStateProps) {
  return (
    <div className="occ-chat-empty-state">
      <h3 className="occ-chat-empty-state__title">{title}</h3>
      <p className="occ-chat-empty-state__message">{message}</p>
      {hint && <p className="occ-chat-empty-state__hint">{hint}</p>}
    </div>
  );
}
