import { sourceLine } from '@/lib/format';

export function Banner({ data }) {
  const { kind, snapshot, capturedAt, stale, note } = data;
  const failed = snapshot.meta?.failedChannels || [];
  const warn = kind === 'demo' || stale;
  return (
    <div className={`banner${kind === 'demo' ? ' demo' : ''}${stale ? ' stale' : ''}`} role="status" data-banner>
      <span className={`dot${warn ? ' amber' : ''}`} aria-hidden="true" />
      <div>
        <strong>{sourceLine(kind, snapshot, capturedAt)}</strong>
        {kind === 'demo' && <small>{note || 'Showing demo data.'} Add your API keys and channels to see live numbers.</small>}
        {kind === 'snapshot' && note && <small>{note}</small>}
        {stale && <small className="status-warn">Stale data: the last update was more than 36 hours ago.</small>}
        {failed.length > 0 && <small>{failed.length} channel{failed.length === 1 ? '' : 's'} could not be read in the last refresh.</small>}
      </div>
    </div>
  );
}
