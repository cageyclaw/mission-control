import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSessionsStore } from '../../stores/sessionsStore';
import { useChatStore } from '../../stores/chat';
import type { Session } from '../../api/types';

interface SessionSelectorProps {
  onSessionChangeStart?: (sessionKey: string) => void;
  onSessionChangeComplete?: (sessionKey: string) => void;
}

function getSessionLabel(session: Session | undefined, fallbackKey: string | null): string {
  if (!session && !fallbackKey) return 'No session available';
  return session?.displayName || session?.label || fallbackKey || 'Unknown session';
}

function getStatusClass(status?: string): string {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'running') return 'running';
  if (normalized === 'done') return 'done';
  if (normalized === 'failed' || normalized === 'killed' || normalized === 'timeout') return 'error';
  return 'idle';
}

export default function SessionSelector({ onSessionChangeStart, onSessionChangeComplete }: SessionSelectorProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hadOpenedRef = useRef(false);
  const listboxId = useId();

  const selectedSessionKey = useSessionsStore((state) => state.selectedSessionKey);
  const mainSessionKey = useSessionsStore((state) => state.mainSessionKey);
  const sessionsByKey = useSessionsStore((state) => state.sessionsByKey);
  const sessionKeys = useSessionsStore((state) => state.sessionKeys);
  const sessionActivityByKey = useSessionsStore((state) => state.sessionActivityByKey);
  const selectSession = useSessionsStore((state) => state.selectSession);

  const chatSessionKey = useChatStore((state) => state.sessionKey);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [switchingTargetKey, setSwitchingTargetKey] = useState<string | null>(null);

  const effectiveSelectedKey = selectedSessionKey ?? mainSessionKey;

  const sortedSessions = useMemo(() => {
    const sessions = sessionKeys
      .map((key) => sessionsByKey[key])
      .filter((session): session is Session => !!session);

    return sessions.sort((a, b) => {
      if (a.key === mainSessionKey && b.key !== mainSessionKey) return -1;
      if (b.key === mainSessionKey && a.key !== mainSessionKey) return 1;

      const aTs = sessionActivityByKey[a.key] ?? a.updatedAt ?? a.startedAt ?? 0;
      const bTs = sessionActivityByKey[b.key] ?? b.updatedAt ?? b.startedAt ?? 0;
      return bTs - aTs;
    });
  }, [mainSessionKey, sessionActivityByKey, sessionKeys, sessionsByKey]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedSessions;
    return sortedSessions.filter((session) => {
      const label = `${session.displayName || ''} ${session.label || ''} ${session.key}`.toLowerCase();
      return label.includes(q);
    });
  }, [searchQuery, sortedSessions]);

  const selectedSession = effectiveSelectedKey ? sessionsByKey[effectiveSelectedKey] : undefined;
  const selectedLabel = getSessionLabel(selectedSession, effectiveSelectedKey);

  const isSwitching = !!switchingTargetKey && chatSessionKey !== switchingTargetKey;

  useEffect(() => {
    if (!switchingTargetKey) return;
    if (chatSessionKey === switchingTargetKey) {
      onSessionChangeComplete?.(switchingTargetKey);
      setSwitchingTargetKey(null);
    }
  }, [chatSessionKey, onSessionChangeComplete, switchingTargetKey]);

  useEffect(() => {
    if (isOpen) {
      hadOpenedRef.current = true;
    }

    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setSearchQuery('');
    if (hadOpenedRef.current) {
      triggerRef.current?.focus();
      hadOpenedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!filteredSessions.length) {
      setActiveIndex(0);
      return;
    }

    const selectedIndex = filteredSessions.findIndex((session) => session.key === effectiveSelectedKey);
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }

    if (activeIndex >= filteredSessions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, effectiveSelectedKey, filteredSessions]);

  const chooseSession = (session: Session) => {
    if (session.key === effectiveSelectedKey) {
      setIsOpen(false);
      return;
    }

    onSessionChangeStart?.(session.key);
    setSwitchingTargetKey(session.key);
    selectSession(session.key);
    setIsOpen(false);
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const onListboxKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!filteredSessions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredSessions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredSessions.length) % filteredSessions.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const session = filteredSessions[activeIndex];
      if (session) chooseSession(session);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="occ-session-selector">
      <button
        ref={triggerRef}
        type="button"
        className="occ-session-selector__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={sortedSessions.length === 0}
      >
        <span className="occ-session-selector__trigger-text" title={selectedLabel}>{selectedLabel}</span>
        {isSwitching ? <span className="occ-session-selector__loading" aria-hidden="true" /> : null}
      </button>

      {isOpen && (
        <div className="occ-session-selector__menu" ref={menuRef}>
          {sortedSessions.length > 10 ? (
            <input
              type="text"
              className="occ-session-selector__search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search sessions…"
              aria-label="Search sessions"
              autoFocus
            />
          ) : null}

          <div
            id={listboxId}
            role="listbox"
            className="occ-session-selector__listbox"
            tabIndex={-1}
            onKeyDown={onListboxKeyDown}
            aria-label="Available sessions"
          >
            {filteredSessions.length === 0 ? (
              <div className="occ-session-selector__empty">No sessions match your search.</div>
            ) : (
              filteredSessions.map((session, index) => {
                const isSelected = session.key === effectiveSelectedKey;
                const isHighlighted = index === activeIndex;
                const label = session.displayName || session.label || session.key;

                return (
                  <button
                    key={session.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`occ-session-selector__option${isSelected ? ' occ-session-selector__option--active' : ''}${isHighlighted ? ' occ-session-selector__option--highlighted' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseSession(session)}
                    title={session.key}
                  >
                    <span className="occ-session-selector__option-main">
                      <span className={`occ-session-selector__status occ-session-selector__status--${getStatusClass(session.status)}`} aria-hidden="true" />
                      <span className="occ-session-selector__name">{label}</span>
                      {session.key === mainSessionKey ? <span className="occ-session-selector__badge">Main</span> : null}
                    </span>
                    <span className="occ-session-selector__meta">
                      {session.percentUsed}% context
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
