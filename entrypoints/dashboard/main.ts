import type { RuntimeReply, QueueItem } from '../../src/shared/types';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;

function appendText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function queueLabel(item: QueueItem): string {
  if (item.held) return 'Held';
  return item.attempts > 0 ? 'Retry pending' : 'Queued';
}

async function main() {
  const result = await chrome.runtime.sendMessage({ type: 'GET_STATE' }) as RuntimeReply;
  if (!result.state) throw new Error(result.message ?? 'Could not load local dashboard data.');
  const { history, queue, reviews } = result.state;
  const synced = history.filter((item) => item.status === 'synced').length;
  const duplicates = history.filter((item) => item.status === 'duplicate').length;
  const failed = history.filter((item) => item.status === 'failed').length;
  const terminal = synced + duplicates + failed;
  const successRate = terminal ? `${Math.round(((synced + duplicates) / terminal) * 100)}%` : '—';
  const timed = history.filter((item) => typeof item.latencyMs === 'number');
  const mean = timed.length
    ? Math.round(timed.reduce((sum, item) => sum + (item.latencyMs ?? 0), 0) / timed.length)
    : null;

  root.replaceChildren();
  appendText(root, 'h1', 'BlinkSync Health');
  appendText(root, 'p', 'Local-only statistics. No telemetry or analytics server.');

  const cards = document.createElement('section');
  cards.className = 'cards';
  for (const value of [
    `${synced} synced`,
    `${queue.length} queued / held`,
    `${failed} failed`,
    `${successRate} success rate`,
    mean === null ? 'Latency pending' : `${mean} ms avg push`,
  ]) appendText(cards, 'div', value, 'card');
  root.append(cards);

  const due = reviews.filter((item) => item.dueAt <= Date.now());
  appendText(root, 'h2', `Reviews due now (${due.length})`);
  const dueList = document.createElement('ul');
  for (const item of due) appendText(dueList, 'li', `${item.problemNumber}. ${item.problemTitle} · ${item.difficulty}`);
  if (!due.length) appendText(dueList, 'li', 'No reviews due today.');
  root.append(dueList);

  const difficultyCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  for (const item of history) {
    if (item.status === 'synced' || item.status === 'duplicate') {
      difficultyCounts.set(item.difficulty, (difficultyCounts.get(item.difficulty) ?? 0) + 1);
    }
    for (const topic of item.topics ?? []) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }
  appendText(root, 'h2', 'Repository breakdown');
  appendText(root, 'p', `Difficulty: ${[...difficultyCounts].map(([key, value]) => `${key} ${value}`).join(' · ') || 'No data'}\nTopics: ${[...topicCounts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([key, value]) => `${key} ${value}`).join(' · ') || 'No data'}`);

  appendText(root, 'h2', `Retry queue (${queue.length})`);
  if (!queue.length) appendText(root, 'p', 'No pending submissions.');
  else {
    const queueTable = document.createElement('table');
    const queueHead = document.createElement('tr');
    for (const label of ['Submission', 'State', 'Attempts', 'Next attempt', 'Details']) appendText(queueHead, 'th', label);
    const queueThead = document.createElement('thead'); queueThead.append(queueHead); queueTable.append(queueThead);
    const queueBody = document.createElement('tbody');
    for (const item of queue) {
      const row = document.createElement('tr');
      const title = item.payload?.submission.question.title ?? `Submission ${item.candidate.submissionId}`;
      const next = item.held ? 'On hold' : new Date(item.nextAttemptAt).toLocaleString();
      for (const value of [title, queueLabel(item), String(item.attempts), next, item.lastError ?? '—']) appendText(row, 'td', value);
      queueBody.append(row);
    }
    queueTable.append(queueBody); root.append(queueTable);
  }

  appendText(root, 'h2', 'Sync history');
  const table = document.createElement('table');
  const head = document.createElement('tr');
  for (const label of ['Problem', 'Status', 'Path', 'Latency']) appendText(head, 'th', label);
  const thead = document.createElement('thead'); thead.append(head); table.append(thead);
  const body = document.createElement('tbody');
  for (const item of history) {
    const row = document.createElement('tr');
    for (const value of [
      item.problemTitle || item.submissionId,
      item.status,
      item.path || item.message || '—',
      item.latencyMs == null ? '—' : `${item.latencyMs} ms`,
    ]) appendText(row, 'td', value);
    body.append(row);
  }
  table.append(body); root.append(table);
}

void main().catch((error) => {
  root.replaceChildren();
  appendText(root, 'p', error instanceof Error ? error.message : 'Dashboard failed to load.');
});
