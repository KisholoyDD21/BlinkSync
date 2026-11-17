import type { RuntimeReply, QueueItem, SyncRecord } from '../../src/shared/types';
import {
  GITHUB_ICON,
  LEETCODE_ICON,
  GIT_COMMIT_ICON,
  BOOK_ICON,
  DASHBOARD_ICON,
  RELEASE_ICON,
  SEARCH_ICON,
  SHIELD_ICON,
} from '../../src/shared/icons';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;

function getAssetUrl(path: string): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
  } catch {}
  return path;
}

function appendEl(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function createEl(tag: keyof HTMLElementTagNameMap, className?: string, html?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

function statusPill(status: string): string {
  return `<span class="pill pill-${status}">${status}</span>`;
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

  // Header
  const header = createEl('header', 'dashboard-header');
  const icon = document.createElement('img');
  icon.src = getAssetUrl('/icon/128.png');
  icon.alt = 'BlinkSync';
  header.append(icon);

  const titleWrap = createEl('div');
  appendEl(titleWrap, 'h1', 'BlinkSync Health');
  const subtitle = createEl(
    'p',
    'dashboard-subtitle',
    `${LEETCODE_ICON(13)} LeetCode → ${GITHUB_ICON(13)} GitHub · Local statistics · Zero telemetry`
  );
  titleWrap.append(subtitle);
  header.append(titleWrap);

  const badge = createEl('span', 'header-badge', `${SHIELD_ICON(12)} Private & Local`);
  header.append(badge);
  root.append(header);

  // Stat cards
  const cards = createEl('section', 'cards');
  const cardData: Array<{ value: string; label: string; cls: string }> = [
    { value: String(synced), label: 'Synced', cls: 'synced' },
    { value: String(queue.length), label: 'Queued / Held', cls: 'queued' },
    { value: String(failed), label: 'Failed', cls: 'failed' },
    { value: successRate, label: 'Success Rate', cls: 'rate' },
    { value: mean === null ? '—' : `${mean}ms`, label: 'Avg Push Latency', cls: 'latency' },
  ];
  for (const data of cardData) {
    const card = createEl('div', 'card');
    appendEl(card, 'div', data.value, `card-value ${data.cls}`);
    appendEl(card, 'div', data.label, 'card-label');
    cards.append(card);
  }
  root.append(cards);

  // Reviews due
  const due = reviews.filter((item) => item.dueAt <= Date.now());
  const reviewH2 = createEl('h2', undefined, `${BOOK_ICON(16)} Reviews Due <span class="count">${due.length}</span>`);
  root.append(reviewH2);
  if (!due.length) {
    appendEl(root, 'div', 'No reviews due today. Keep practicing!', 'empty-message');
  } else {
    const dueList = createEl('ul', 'reviews-list');
    for (const item of due) {
      const li = createEl('li', 'review-item');
      appendEl(li, 'span', `${item.problemNumber}. ${item.problemTitle}`);
      appendEl(li, 'span', item.difficulty, `review-difficulty diff-${item.difficulty}`);
      dueList.append(li);
    }
    root.append(dueList);
  }

  // Repository breakdown with Visual Bar
  const difficultyCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  for (const item of history) {
    if (item.status === 'synced' || item.status === 'duplicate') {
      const diff = item.difficulty || 'Unknown';
      difficultyCounts.set(diff, (difficultyCounts.get(diff) ?? 0) + 1);
    }
    for (const topic of item.topics ?? []) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }

  const easyCount = difficultyCounts.get('Easy') ?? 0;
  const mediumCount = difficultyCounts.get('Medium') ?? 0;
  const hardCount = difficultyCounts.get('Hard') ?? 0;
  const totalDiff = easyCount + mediumCount + hardCount || 1;

  root.append(createEl('h2', undefined, `${DASHBOARD_ICON(16)} Problem Breakdown`));

  const breakdownCard = createEl('div', 'breakdown-card');
  const barContainer = createEl('div', 'diff-bar-container');
  const barLabels = createEl('div', 'diff-bar-labels');
  barLabels.innerHTML = `
    <span class="diff-badge"><span class="dot easy"></span> Easy: ${easyCount}</span>
    <span class="diff-badge"><span class="dot medium"></span> Medium: ${mediumCount}</span>
    <span class="diff-badge"><span class="dot hard"></span> Hard: ${hardCount}</span>
  `;
  const diffBar = createEl('div', 'diff-bar');
  if (totalDiff > 0 && (easyCount || mediumCount || hardCount)) {
    const easyPct = (easyCount / totalDiff) * 100;
    const medPct = (mediumCount / totalDiff) * 100;
    const hardPct = (hardCount / totalDiff) * 100;
    diffBar.innerHTML = `
      <div class="diff-seg easy" style="width: ${easyPct}%" title="Easy: ${easyCount}"></div>
      <div class="diff-seg medium" style="width: ${medPct}%" title="Medium: ${mediumCount}"></div>
      <div class="diff-seg hard" style="width: ${hardPct}%" title="Hard: ${hardCount}"></div>
    `;
  }
  barContainer.append(barLabels, diffBar);
  breakdownCard.append(barContainer);

  const topTopics = [...topicCounts].sort((a, b) => b[1] - a[1]).slice(0, 14);
  if (topTopics.length) {
    appendEl(breakdownCard, 'div', 'Top Topics', 'card-label');
    const topicsBox = createEl('div', 'topics-container');
    for (const [topic, count] of topTopics) {
      const tag = createEl('span', 'topic-tag', `${topic} <strong>${count}</strong>`);
      topicsBox.append(tag);
    }
    breakdownCard.append(topicsBox);
  }
  root.append(breakdownCard);

  // Retry queue
  root.append(createEl('h2', undefined, `${RELEASE_ICON(16)} Retry Queue <span class="count">${queue.length}</span>`));
  if (!queue.length) {
    appendEl(root, 'div', 'No pending submissions in the queue.', 'empty-message');
  } else {
    const queueTable = document.createElement('table');
    const queueHead = document.createElement('tr');
    for (const label of ['Submission', 'State', 'Attempts', 'Next Attempt', 'Details']) appendEl(queueHead, 'th', label);
    const queueThead = document.createElement('thead'); queueThead.append(queueHead); queueTable.append(queueThead);
    const queueBody = document.createElement('tbody');
    for (const item of queue) {
      const row = document.createElement('tr');
      const title = item.payload?.submission.question.title ?? `Submission ${item.candidate.submissionId}`;
      const next = item.held ? 'On hold' : new Date(item.nextAttemptAt).toLocaleString();
      appendEl(row, 'td', title);
      const stateCell = document.createElement('td');
      stateCell.innerHTML = statusPill(item.held ? 'held' : 'queued');
      row.append(stateCell);
      appendEl(row, 'td', String(item.attempts));
      appendEl(row, 'td', next);
      appendEl(row, 'td', item.lastError ?? '—');
      queueBody.append(row);
    }
    queueTable.append(queueBody); root.append(queueTable);
  }

  // Sync history with Search & Filter
  root.append(createEl('h2', undefined, `${GIT_COMMIT_ICON(16)} Sync History <span class="count" id="history-count">${history.length}</span>`));

  let filterStatus = 'all';
  let searchTerm = '';

  const filterBar = createEl('div', 'filter-bar');
  const searchBox = createEl('div', 'search-box');
  searchBox.innerHTML = `<span class="search-icon-wrap">${SEARCH_ICON(14)}</span>`;
  const searchInput = createEl('input', 'search-input') as HTMLInputElement;
  searchInput.placeholder = 'Search problem name or file path...';
  searchBox.append(searchInput);

  const filterChips = createEl('div', 'filter-chips');
  const statuses = ['all', 'synced', 'failed', 'duplicate'];
  const chipEls: HTMLElement[] = [];

  for (const st of statuses) {
    const chip = createEl('button', `filter-chip ${st === 'all' ? 'active' : ''}`, st.charAt(0).toUpperCase() + st.slice(1));
    chip.addEventListener('click', () => {
      chipEls.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      filterStatus = st;
      renderHistoryTable();
    });
    chipEls.push(chip);
    filterChips.append(chip);
  }

  filterBar.append(searchBox, filterChips);
  root.append(filterBar);

  const tableContainer = createEl('div');
  root.append(tableContainer);

  function renderHistoryTable() {
    tableContainer.replaceChildren();

    const filtered = history.filter((item) => {
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;
      const textToSearch = `${item.problemTitle || ''} ${item.submissionId || ''} ${item.path || ''}`.toLowerCase();
      const matchSearch = !searchTerm || textToSearch.includes(searchTerm);
      return matchStatus && matchSearch;
    });

    const countBadge = document.querySelector<HTMLElement>('#history-count');
    if (countBadge) countBadge.textContent = String(filtered.length);

    if (!filtered.length) {
      appendEl(tableContainer, 'div', 'No matching sync records found.', 'empty-message');
      return;
    }

    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const label of ['Problem', 'Status', 'Repository Path', 'Latency']) appendEl(head, 'th', label);
    const thead = document.createElement('thead'); thead.append(head); table.append(thead);
    const body = document.createElement('tbody');

    for (const item of filtered) {
      const row = document.createElement('tr');
      appendEl(row, 'td', item.problemTitle || item.submissionId);
      const statusCell = document.createElement('td');
      statusCell.innerHTML = statusPill(item.status);
      row.append(statusCell);
      appendEl(row, 'td', item.path || item.message || '—');
      appendEl(row, 'td', item.latencyMs == null ? '—' : `${item.latencyMs}ms`);
      body.append(row);
    }
    table.append(body);
    tableContainer.append(table);
  }

  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    renderHistoryTable();
  });

  renderHistoryTable();
}

void main().catch((error) => {
  root.replaceChildren();
  appendEl(root, 'p', error instanceof Error ? error.message : 'Dashboard failed to load.');
});
