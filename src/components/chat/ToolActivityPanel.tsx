import { useMemo } from 'react';
import type { ChatToolRun } from '../../api/types';
import ToolActivityItem from './ToolActivityItem';

interface ToolActivityPanelProps {
  toolRuns: ChatToolRun[];
}

const MAX_VISIBLE_RUNS = 12;

export default function ToolActivityPanel({ toolRuns }: ToolActivityPanelProps) {
  const runningCount = toolRuns.filter((run) => run.status === 'running').length;

  const orderedRuns = useMemo(() => {
    const sorted = [...toolRuns].sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1;
      if (a.status !== 'running' && b.status === 'running') return 1;
      return (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt);
    });

    return sorted.slice(0, MAX_VISIBLE_RUNS);
  }, [toolRuns]);

  if (toolRuns.length === 0) return null;

  return (
    <section className="occ-tool-activity" aria-live="polite">
      <header className="occ-tool-activity__header">
        <h4 className="occ-tool-activity__title">Tool Activity</h4>
        {runningCount > 0 ? (
          <span className="occ-tool-activity__working">Q is working... {runningCount > 1 ? `(${runningCount} tools active)` : ''}</span>
        ) : (
          <span className="occ-tool-activity__idle">All tools idle</span>
        )}
      </header>

      <div className="occ-tool-activity__list">
        {orderedRuns.map((run) => (
          <ToolActivityItem key={run.id} run={run} />
        ))}
      </div>

      {toolRuns.length > MAX_VISIBLE_RUNS ? (
        <p className="occ-tool-activity__retention-note">Showing latest {MAX_VISIBLE_RUNS} runs.</p>
      ) : null}
    </section>
  );
}
