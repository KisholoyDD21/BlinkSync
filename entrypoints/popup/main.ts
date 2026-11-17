import type { BlinkConfig, RuntimeReply } from '../../src/shared/types';
import { DEFAULT_CONFIG } from '../../src/shared/constants';
import {
  OVERVIEW_ICON,
  SETTINGS_ICON,
  ACTIVITY_ICON,
  SAVE_ICON,
  TEST_ICON,
  RETRY_ICON,
  RELEASE_ICON,
  DASHBOARD_ICON,
  TRASH_ICON,
  GITHUB_ICON,
  LEETCODE_ICON,
  GIT_COMMIT_ICON,
  LOCK_ICON,
  CHECK_ICON,
} from '../../src/shared/icons';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;
let config: BlinkConfig = { ...DEFAULT_CONFIG };
let activeTab: 'home' | 'setup' | 'activity' = 'home';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function field(labelText: string, input: HTMLInputElement | HTMLSelectElement, hint?: string, iconSvg?: string): HTMLElement {
  const wrap = el('div', { class: 'field' });
  const labelEl = el('span', { class: 'field-label' });
  if (iconSvg) labelEl.innerHTML = `${iconSvg} ${labelText}`;
  else labelEl.textContent = labelText;
  wrap.append(labelEl, input);
  if (hint) wrap.append(el('span', { class: 'field-hint' }, hint));
  return wrap;
}

function statusPill(status: string): HTMLElement {
  const cls = `pill pill-${status}`;
  return el('span', { class: cls }, status);
}

async function send(message: unknown): Promise<RuntimeReply> {
  return await chrome.runtime.sendMessage(message) as RuntimeReply;
}

function getAssetUrl(path: string): string {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(path);
    }
  } catch {}
  return path;
}

function showFeedback(container: HTMLElement, message: string, kind: 'good' | 'bad'): void {
  const existing = container.querySelector('.feedback');
  if (existing) existing.remove();
  const fb = el('div', { class: 'feedback', 'data-kind': kind, 'aria-live': 'polite' });
  fb.innerHTML = `${kind === 'good' ? CHECK_ICON(14) : '✕'} <span>${message}</span>`;
  container.prepend(fb);
  if (kind === 'good') setTimeout(() => fb.classList.add('hidden'), 4000);
}

function renderHeader(connected: boolean): HTMLElement {
  const header = el('header', { class: 'header' });
  const brand = el('div', { class: 'brand' });

  // Extension Icon
  const icon = el('img', {
    class: 'brand-icon',
    src: getAssetUrl('/icon/48.png'),
    alt: 'BlinkSync',
    width: '28',
    height: '28',
  });
  const text = el('div', { class: 'brand-text' });
  const eyebrow = el('span', { class: 'eyebrow' });
  eyebrow.innerHTML = `${LEETCODE_ICON(11)} LeetCode → ${GITHUB_ICON(11)} <span class="gh-span">GitHub</span>`;
  text.append(eyebrow, el('h1', {}, 'BlinkSync'));
  brand.append(icon, text);

  const statusEl = el('span', {
    class: connected ? 'status good' : 'status disconnected',
  }, connected ? 'Connected' : 'Disconnected');

  header.append(brand, statusEl);
  return header;
}

function renderTabs(failedCount: number, queuedCount: number): HTMLElement {
  const tabs = el('nav', { class: 'tabs', role: 'tablist' });

  const homeTab = el('button', { class: `tab ${activeTab === 'home' ? 'active' : ''}`, role: 'tab', 'aria-selected': String(activeTab === 'home') });
  homeTab.innerHTML = `${OVERVIEW_ICON(14)} <span>Overview</span>`;
  homeTab.addEventListener('click', () => { activeTab = 'home'; void render(); });

  const setupTab = el('button', { class: `tab ${activeTab === 'setup' ? 'active' : ''}`, role: 'tab', 'aria-selected': String(activeTab === 'setup') });
  setupTab.innerHTML = `${SETTINGS_ICON(14)} <span>Setup</span>`;
  setupTab.addEventListener('click', () => { activeTab = 'setup'; void render(); });

  const activityTab = el('button', { class: `tab ${activeTab === 'activity' ? 'active' : ''}`, role: 'tab', 'aria-selected': String(activeTab === 'activity') });
  activityTab.innerHTML = `${ACTIVITY_ICON(14)} <span>Activity</span>`;
  if (failedCount > 0) {
    const badge = el('span', { class: 'tab-badge' }, String(failedCount));
    activityTab.append(badge);
  }
  activityTab.addEventListener('click', () => { activeTab = 'activity'; void render(); });

  tabs.append(homeTab, setupTab, activityTab);
  return tabs;
}

function renderHomePanel(state: RuntimeReply['state']): HTMLElement {
  const panel = el('div', { class: `tab-panel ${activeTab === 'home' ? 'active' : ''}`, role: 'tabpanel' });
  const history = state?.history ?? [];
  const queue = state?.queue ?? [];

  const syncedCount = history.filter((item) => item.status === 'synced').length;
  const failedCount = history.filter((item) => item.status === 'failed').length;

  // Stats cards
  const stats = el('section', { class: 'stats' });
  const syncedCard = el('div', { class: 'stat' });
  syncedCard.append(el('div', { class: 'stat-value synced' }, String(syncedCount)));
  syncedCard.append(el('div', { class: 'stat-label' }, 'Synced'));
  const queuedCard = el('div', { class: 'stat' });
  queuedCard.append(el('div', { class: 'stat-value queued' }, String(queue.length)));
  queuedCard.append(el('div', { class: 'stat-label' }, 'Queued'));
  const failedCard = el('div', { class: 'stat' });
  failedCard.append(el('div', { class: 'stat-value failed' }, String(failedCount)));
  failedCard.append(el('div', { class: 'stat-label' }, 'Failed'));
  stats.append(syncedCard, queuedCard, failedCard);
  panel.append(stats);

  // Quick actions
  const actions = el('div', { class: 'quick-actions' });
  const retryBtn = el('button', {}, '');
  retryBtn.innerHTML = `${RETRY_ICON(13)} <span>Retry failed</span>`;
  retryBtn.addEventListener('click', async () => {
    retryBtn.classList.add('btn-loading');
    retryBtn.innerHTML = '<span class="spinner"></span> <span>Retrying…</span>';
    const result = await send({ type: 'RETRY_FAILED' });
    showFeedback(panel, result.message ?? 'Retry attempted.', result.ok ? 'good' : 'bad');
    retryBtn.classList.remove('btn-loading');
    retryBtn.innerHTML = `${RETRY_ICON(13)} <span>Retry failed</span>`;
  });

  const releaseBtn = el('button', {}, '');
  releaseBtn.innerHTML = `${RELEASE_ICON(13)} <span>Release queue</span>`;
  releaseBtn.addEventListener('click', async () => {
    releaseBtn.classList.add('btn-loading');
    releaseBtn.innerHTML = '<span class="spinner"></span> <span>Releasing…</span>';
    const result = await send({ type: 'RELEASE_CONTEST_QUEUE' });
    showFeedback(panel, result.message ?? 'Queue released.', result.ok ? 'good' : 'bad');
    releaseBtn.classList.remove('btn-loading');
    releaseBtn.innerHTML = `${RELEASE_ICON(13)} <span>Release queue</span>`;
  });

  const dashBtn = el('button', {}, '');
  dashBtn.innerHTML = `${DASHBOARD_ICON(13)} <span>Dashboard</span>`;
  dashBtn.addEventListener('click', () => { void chrome.tabs.create({ url: chrome.runtime.getURL('/dashboard.html') }); });

  actions.append(retryBtn, releaseBtn, dashBtn);
  panel.append(actions);

  // Recent activity header
  const header = el('div', { class: 'section-header' });
  header.innerHTML = `${GIT_COMMIT_ICON(14)} <span>Recent Syncs</span>`;
  panel.append(header);

  // History list
  const list = el('div', { class: 'history' });
  if (!history.length) {
    const empty = el('div', { class: 'empty-state' });
    empty.innerHTML = `
      ${GIT_COMMIT_ICON(32)}
      <div class="empty-state-title">No submissions synced yet</div>
      <div class="empty-state-desc">Submit an Accepted solution on LeetCode and it will automatically commit here.</div>
    `;
    list.append(empty);
  } else {
    history.slice(0, 5).forEach((item) => {
      const row = el('div', { class: 'history-row' });
      const rowHeader = el('div', { class: 'history-row-header' });
      rowHeader.append(el('strong', {}, item.problemTitle || item.submissionId));
      rowHeader.append(statusPill(item.status));
      row.append(rowHeader);
      const timeAgo = getRelativeTime(item.createdAt);
      row.append(el('small', {}, `${timeAgo}${item.latencyMs != null ? ` · ${item.latencyMs}ms latency` : ''}`));
      if (item.message) row.append(el('small', {}, item.message));
      list.append(row);
    });
  }
  panel.append(list);

  return panel;
}

function renderSetupPanel(state: RuntimeReply['state']): HTMLElement {
  const panel = el('div', { class: `tab-panel ${activeTab === 'setup' ? 'active' : ''}`, role: 'tabpanel' });
  const form = el('div', { class: 'form' });

  // Repository & Branch (side by side)
  const repo = el('input', { type: 'text', placeholder: 'owner/repository', value: config.repo, autocomplete: 'off', spellcheck: 'false' });
  const branch = el('input', { type: 'text', value: config.branch, placeholder: 'main' });
  const repoField = field('GitHub repository', repo, undefined, GITHUB_ICON(13));
  const branchField = field('Target branch', branch, undefined, GIT_COMMIT_ICON(13));
  const row = el('div', { class: 'field-row' });
  row.append(repoField, branchField);
  form.append(row);

  // Token field
  const tokenWrap = el('div', { class: 'field' });
  const tokenLabel = el('span', { class: 'field-label' });
  tokenLabel.innerHTML = `${LOCK_ICON(13)} GitHub token (session only)`;
  tokenWrap.append(tokenLabel);

  if (state?.connected) {
    const saved = el('div', { class: 'token-saved' });
    saved.innerHTML = `${CHECK_ICON(12)} Token active for this session`;
    tokenWrap.append(saved);
  }
  const tokenRow = el('div', { class: 'token-row' });
  const token = el('input', { type: 'password', placeholder: 'ghp_xxxxxxxxxxxx', autocomplete: 'off' });
  tokenRow.append(token);
  tokenWrap.append(tokenRow);

  const tokenLink = el('a', {
    class: 'token-link',
    href: '#',
    title: 'Create a fine-grained PAT on GitHub',
  });
  tokenLink.innerHTML = `${GITHUB_ICON(12)} Generate token on GitHub`;
  tokenLink.addEventListener('click', (e) => {
    e.preventDefault();
    void chrome.tabs.create({ url: 'https://github.com/settings/personal-access-tokens/new' });
  });
  tokenWrap.append(tokenLink);
  form.append(tokenWrap);

  // Templates
  const fileTemplate = el('input', { type: 'text', value: config.fileTemplate, spellcheck: 'false' });
  form.append(field('Solution path template', fileTemplate, '{difficulty}/{problemNumber}-{problemSlug}/solution.{extension}'));
  const commitTemplate = el('input', { type: 'text', value: config.commitTemplate, spellcheck: 'false' });
  form.append(field('Commit message template', commitTemplate));

  // Duplicate mode
  const mode = el('select');
  mode.append(new Option('Overwrite existing solution', 'overwrite'), new Option('Keep version variants (v2, v3…)', 'version'));
  mode.value = config.duplicateMode;
  form.append(field('When solution code changes', mode));

  // Contest release
  const releaseAt = el('input', { type: 'datetime-local' });
  if (config.contestReleaseAt) {
    releaseAt.value = new Date(config.contestReleaseAt - new Date(config.contestReleaseAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
  form.append(field('Scheduled contest release', releaseAt));

  // Toggles
  const togglesHeader = el('div', { class: 'section-header mt-md' });
  togglesHeader.innerHTML = `${SETTINGS_ICON(14)} <span>Sync Preferences</span>`;
  form.append(togglesHeader);

  const togglesContainer = el('div', { class: 'toggles' });
  const enabled = el('input', { type: 'checkbox' }); enabled.checked = config.enabled;
  const safeMode = el('input', { type: 'checkbox' }); safeMode.checked = config.contestSafeMode;
  const spaced = el('input', { type: 'checkbox' }); spaced.checked = config.spacedRepetitionEnabled;
  const includeDescription = el('input', { type: 'checkbox' }); includeDescription.checked = config.includeProblemDescription;

  const makeToggle = (input: HTMLInputElement, label: string): HTMLElement => {
    const toggle = el('label', { class: 'toggle' });
    toggle.append(input, el('span', {}, label));
    return toggle;
  };
  togglesContainer.append(
    makeToggle(enabled, 'Automatic sync enabled'),
    makeToggle(safeMode, 'Contest Safe Mode (hold pushes until contest ends)'),
    makeToggle(spaced, 'Local spaced repetition reminders'),
    makeToggle(includeDescription, 'Include full problem statement in GitHub README'),
  );
  form.append(togglesContainer);

  // Consent
  const consent = el('input', { type: 'checkbox' }); consent.checked = config.consentGranted;
  const consentLabel = el('label', { class: 'toggle consent' });
  consentLabel.append(consent, el('span', {}, 'I understand that accepted source code and problem metadata will be sent to the GitHub repository I choose.'));
  form.append(consentLabel);

  // Action buttons
  const actions = el('div', { class: 'form-actions' });
  const save = el('button', { class: 'btn btn-primary', type: 'button' }, '');
  save.innerHTML = `${SAVE_ICON(14)} <span>Save settings</span>`;
  const test = el('button', { class: 'btn btn-secondary', type: 'button' }, '');
  test.innerHTML = `${TEST_ICON(14)} <span>Test connection</span>`;
  const disconnect = el('button', { class: 'btn btn-danger', type: 'button', title: 'Clear the saved token' }, '');
  disconnect.innerHTML = `${TRASH_ICON(14)} <span>Clear token</span>`;
  actions.append(save, test, disconnect);
  form.append(actions);

  // Note
  const note = el('p', { class: 'note' }, 'Personal Access Token is stored in chrome.storage.session and cleared when your browser closes. Use a fine-grained token with Contents: Read and write.');
  form.append(note);

  panel.append(form);

  // Event handlers
  save.addEventListener('click', async () => {
    save.classList.add('btn-loading');
    save.innerHTML = '<span class="spinner"></span> <span>Saving…</span>';
    config = {
      ...config,
      repo: repo.value.trim(), branch: branch.value.trim() || 'main',
      enabled: enabled.checked && consent.checked, consentGranted: consent.checked, fileTemplate: fileTemplate.value.trim(),
      commitTemplate: commitTemplate.value.trim(), duplicateMode: mode.value as BlinkConfig['duplicateMode'],
      contestSafeMode: safeMode.checked, spacedRepetitionEnabled: spaced.checked, includeProblemDescription: includeDescription.checked,
      contestReleaseAt: releaseAt.value ? new Date(releaseAt.value).getTime() : null,
    };
    try {
      if (token.value.trim()) {
        const tokenReply = await send({ type: 'SAVE_TOKEN', token: token.value.trim() });
        if (!tokenReply.ok) throw new Error(tokenReply.message);
        token.value = '';
      }
      const saved = await send({ type: 'SAVE_CONFIG', config });
      if (!saved.ok) throw new Error(saved.message);
      showFeedback(panel, saved.message ?? 'Settings saved successfully.', 'good');
    } catch (error) {
      showFeedback(panel, error instanceof Error ? error.message : 'Save failed.', 'bad');
    }
    save.classList.remove('btn-loading');
    save.innerHTML = `${SAVE_ICON(14)} <span>Save settings</span>`;
  });

  test.addEventListener('click', async () => {
    test.classList.add('btn-loading');
    test.innerHTML = '<span class="spinner"></span> <span>Testing…</span>';
    try {
      if (token.value.trim()) {
        const tokenReply = await send({ type: 'SAVE_TOKEN', token: token.value.trim() });
        if (!tokenReply.ok) throw new Error(tokenReply.message);
        token.value = '';
      }
      const saved = await send({ type: 'SAVE_CONFIG', config: { ...config, repo: repo.value.trim(), branch: branch.value.trim() || 'main' } });
      if (!saved.ok) throw new Error(saved.message);
      const result = await send({ type: 'TEST_CONNECTION' });
      if (!result.ok) throw new Error(result.message);
      showFeedback(panel, result.message ?? 'Connection successful!', 'good');
    } catch (error) {
      showFeedback(panel, error instanceof Error ? error.message : 'Connection test failed.', 'bad');
    }
    test.classList.remove('btn-loading');
    test.innerHTML = `${TEST_ICON(14)} <span>Test connection</span>`;
  });

  disconnect.addEventListener('click', async () => {
    if (!confirm('Clear the saved GitHub token? You will need to re-enter it.')) return;
    const result = await send({ type: 'CLEAR_TOKEN' });
    showFeedback(panel, result.message ?? 'Token cleared.', result.ok ? 'good' : 'bad');
  });

  return panel;
}

function renderActivityPanel(state: RuntimeReply['state']): HTMLElement {
  const panel = el('div', { class: `tab-panel ${activeTab === 'activity' ? 'active' : ''}`, role: 'tabpanel' });
  const history = state?.history ?? [];
  const queue = state?.queue ?? [];

  // Queue section
  if (queue.length > 0) {
    const queueHeader = el('div', { class: 'section-header' });
    queueHeader.innerHTML = `${RELEASE_ICON(14)} <span>Pending Queue (${queue.length})</span>`;
    panel.append(queueHeader);

    const queueList = el('div', { class: 'history' });
    queue.forEach((item) => {
      const row = el('div', { class: 'history-row' });
      const rowHeader = el('div', { class: 'history-row-header' });
      const title = item.payload?.submission.question.title ?? `Submission ${item.candidate.submissionId}`;
      rowHeader.append(el('strong', {}, title));
      rowHeader.append(statusPill(item.held ? 'held' : 'queued'));
      row.append(rowHeader);
      const next = item.held ? 'On hold' : `Next: ${new Date(item.nextAttemptAt).toLocaleString()}`;
      row.append(el('small', {}, `Attempts: ${item.attempts} · ${next}`));
      if (item.lastError) row.append(el('small', {}, `Error: ${item.lastError}`));
      queueList.append(row);
    });
    panel.append(queueList);
  }

  // Full history
  const historyHeader = el('div', { class: 'section-header mt-md' });
  historyHeader.innerHTML = `${ACTIVITY_ICON(14)} <span>Sync History (${history.length})</span>`;
  panel.append(historyHeader);

  const list = el('div', { class: 'history' });
  if (!history.length) {
    const empty = el('div', { class: 'empty-state' });
    empty.innerHTML = `
      ${ACTIVITY_ICON(32)}
      <div class="empty-state-title">Nothing recorded yet</div>
      <div class="empty-state-desc">Your synchronized LeetCode solutions will appear here in chronological order.</div>
    `;
    list.append(empty);
  } else {
    history.forEach((item) => {
      const row = el('div', { class: 'history-row' });
      const rowHeader = el('div', { class: 'history-row-header' });
      rowHeader.append(el('strong', {}, item.problemTitle || item.submissionId));
      rowHeader.append(statusPill(item.status));
      row.append(rowHeader);
      const details: string[] = [getRelativeTime(item.createdAt)];
      if (item.path) details.push(item.path);
      if (item.latencyMs != null) details.push(`${item.latencyMs}ms`);
      row.append(el('small', {}, details.join(' · ')));
      if (item.message) row.append(el('small', {}, item.message));
      list.append(row);
    });
  }
  panel.append(list);

  return panel;
}

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

async function render(): Promise<void> {
  const stateReply = await send({ type: 'GET_STATE' });
  if (stateReply.state) config = stateReply.state.config;
  root.replaceChildren();

  const connected = stateReply.state?.connected ?? false;
  const history = stateReply.state?.history ?? [];
  const queue = stateReply.state?.queue ?? [];
  const failedCount = history.filter((item) => item.status === 'failed').length;

  root.append(renderHeader(connected));
  root.append(renderTabs(failedCount, queue.length));
  root.append(renderHomePanel(stateReply.state));
  root.append(renderSetupPanel(stateReply.state));
  root.append(renderActivityPanel(stateReply.state));
}

void render().catch((error) => { root.textContent = error instanceof Error ? error.message : 'BlinkSync failed to load.'; });
