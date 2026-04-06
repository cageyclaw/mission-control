import { useMemo } from 'react';
import type { ChatToolRun, ChatToolRunStatus } from '../../api/types';

interface ToolActivityItemProps {
  run: ChatToolRun;
}

const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  read: 'Reading file',
  write: 'Updating files',
  edit: 'Updating files',
  exec: 'Executing command',
  web_search: 'Searching web',
  web_fetch: 'Fetching page',
};

function humanLabel(toolName?: string): string {
  if (!toolName) return 'Running tool';
  return TOOL_ACTIVITY_LABELS[toolName] ?? toolName;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function basename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed;
}

function extractInputHint(run: ChatToolRun): string | null {
  const input = asRecord(run.input);
  if (!input) return null;

  const pathValue = input.path ?? input.file_path;
  if (typeof pathValue === 'string' && pathValue.trim()) {
    return basename(pathValue);
  }

  if (typeof input.command === 'string' && input.command.trim()) {
    return input.command.trim().replace(/\s+/g, ' ').slice(0, 72);
  }

  if (typeof input.query === 'string' && input.query.trim()) {
    return `“${input.query.trim().slice(0, 48)}${input.query.trim().length > 48 ? '…' : ''}”`;
  }

  if (typeof input.url === 'string' && input.url.trim()) {
    return input.url.trim().slice(0, 72);
  }

  return null;
}

function stringifyCompact(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;

  try {
    const json = JSON.stringify(value);
    return json.length > 200 ? `${json.slice(0, 200)}…` : json;
  } catch {
    return fallback;
  }
}

function formatStatus(status: ChatToolRunStatus): string {
  if (status === 'running') return 'running';
  if (status === 'error') return 'failed';
  return 'finished';
}

function formatDuration(run: ChatToolRun): string | null {
  if (!run.finishedAt || run.finishedAt <= run.startedAt) return null;
  const durationMs = run.finishedAt - run.startedAt;
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
}

function summaryFor(run: ChatToolRun): string {
  const hint = extractInputHint(run);

  if (run.status === 'running') {
    return hint ?? 'Q is working...';
  }

  const name = run.toolName ?? '';
  if (run.status === 'error') {
    if (name === 'exec') return hint ? `Failed: ${hint}` : 'Command failed';
    return hint ? `Failed: ${hint}` : 'Tool failed';
  }

  if (name === 'read') return hint ? `Read ${hint}` : 'Read 1 file';
  if (name === 'write' || name === 'edit') return hint ? `Updated ${hint}` : 'Updated 1 file';
  if (name === 'web_search') return hint ? `Searched ${hint}` : 'Search complete';
  if (name === 'web_fetch') return hint ? `Fetched ${hint}` : 'Fetched results';
  if (name === 'exec') return hint ? `Ran ${hint}` : 'Command completed';

  return hint ?? 'Tool completed';
}

export default function ToolActivityItem({ run }: ToolActivityItemProps) {
  const title = useMemo(() => humanLabel(run.toolName), [run.toolName]);
  const summary = useMemo(() => summaryFor(run), [run]);
  const duration = useMemo(() => formatDuration(run), [run]);

  return (
    <details className={`occ-tool-activity-item occ-tool-activity-item--${run.status}`}>
      <summary className="occ-tool-activity-item__summary">
        <span className="occ-tool-activity-item__title">{title}</span>
        <span className="occ-tool-activity-item__result">{summary}</span>
        <span className={`occ-tool-activity-item__status occ-tool-activity-item__status--${run.status}`}>
          {formatStatus(run.status)}
        </span>
      </summary>

      <div className="occ-tool-activity-item__details">
        <div className="occ-tool-activity-item__meta">
          <span>Tool: {run.toolName ?? 'unknown'}</span>
          <span>Status: {formatStatus(run.status)}</span>
          {duration ? <span>Duration: {duration}</span> : null}
          {run.runId ? <span>Run: {run.runId}</span> : null}
        </div>

        <div className="occ-tool-activity-item__block">
          <strong>Latest input</strong>
          <p>{stringifyCompact(run.input, 'No input captured')}</p>
        </div>

        {run.status === 'error' ? (
          <div className="occ-tool-activity-item__block occ-tool-activity-item__block--error">
            <strong>Error</strong>
            <p>{run.error ?? 'Tool failed'}</p>
          </div>
        ) : (
          <div className="occ-tool-activity-item__block">
            <strong>Latest output</strong>
            <p>{stringifyCompact(run.output, run.status === 'running' ? 'Pending...' : 'No output captured')}</p>
          </div>
        )}
      </div>
    </details>
  );
}
