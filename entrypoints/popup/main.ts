import type { BlinkConfig, RuntimeReply } from '../../src/shared/types';
import { DEFAULT_CONFIG } from '../../src/shared/constants';
import './style.css';

const root = document.querySelector<HTMLElement>('#app')!;
let config: BlinkConfig = { ...DEFAULT_CONFIG };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function field(labelText: string, input: HTMLInputElement | HTMLSelectElement): HTMLElement {
  const wrap = el('label', { class: 'field' });
  wrap.append(el('span', {}, labelText), input);
  return wrap;
}

async function send(message: unknown): Promise<RuntimeReply> {
  return await chrome.runtime.sendMessage(message) as RuntimeReply;
}

async function render(): Promise<void> {
  const stateReply = await send({ type: 'GET_STATE' });
  if (stateReply.state) config = stateReply.state.config;
  root.replaceChildren();

  const header = el('header', { class: 'header' });
  const brand = el('div');
  brand.append(el('div', { class: 'eyebrow' }, 'LEETCODE → GITHUB'), el('h1', {}, 'BlinkSync'));
  header.append(brand, el('span', { class: stateReply.state?.connected ? 'status good' : 'status' }, stateReply.state?.connected ? 'Connected' : 'Not connected'));
  root.append(header);

  const form = el('form', { class: 'form' });
  const repo = el('input', { type: 'text', placeholder: 'owner/repository', value: config.repo, autocomplete: 'off' });
  const branch = el('input', { type: 'text', value: config.branch, placeholder: 'main' });
  const token = el('input', { type: 'password', placeholder: 'Fine-grained GitHub PAT', autocomplete: 'off' });
  const fileTemplate = el('input', { type: 'text', value: config.fileTemplate });
  const commitTemplate = el('input', { type: 'text', value: config.commitTemplate });
  form.append(field('GitHub repository', repo), field('Target branch', branch), field('GitHub token (session only)', token));
  form.append(field('Solution path template', fileTemplate), field('Commit message template', commitTemplate));

  const mode = el('select');
  mode.append(new Option('Overwrite the existing solution', 'overwrite'), new Option('Keep variants (solution-v2, v3…)', 'version'));
  mode.value = config.duplicateMode;
  form.append(field('When the solution changes', mode));

  const enabled = el('input', { type: 'checkbox' }); enabled.checked = config.enabled;
  const safeMode = el('input', { type: 'checkbox' }); safeMode.checked = config.contestSafeMode;
  const spaced = el('input', { type: 'checkbox' }); spaced.checked = config.spacedRepetitionEnabled;
  const includeDescription = el('input', { type: 'checkbox' }); includeDescription.checked = config.includeProblemDescription;
  const consent = el('input', { type: 'checkbox' }); consent.checked = config.consentGranted;
  const consentLabel = el('label', { class: 'toggle consent' }); consentLabel.append(consent, el('span', {}, 'I understand that accepted source code and problem metadata will be sent to the GitHub repository I choose.'));
  const releaseAt = el('input', { type: 'datetime-local' });
  if (config.contestReleaseAt) releaseAt.value = new Date(config.contestReleaseAt - new Date(config.contestReleaseAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  form.append(field('Optional automatic contest release time', releaseAt));
  const toggles = el('div', { class: 'toggles' });
  const enabledLabel = el('label', { class: 'toggle' }); enabledLabel.append(enabled, el('span', {}, 'Automatic sync enabled'));
  const contestLabel = el('label', { class: 'toggle' }); contestLabel.append(safeMode, el('span', {}, 'Contest Safe Mode (hold pushes)'));
  const spacedLabel = el('label', { class: 'toggle' }); spacedLabel.append(spaced, el('span', {}, 'Enable local spaced repetition'));
  const descriptionLabel = el('label', { class: 'toggle' }); descriptionLabel.append(includeDescription, el('span', {}, 'Include full LeetCode problem statement in GitHub README (optional)'));
  toggles.append(enabledLabel, contestLabel, spacedLabel, descriptionLabel, consentLabel); form.append(toggles);

  const buttons = el('div', { class: 'buttons' });
  const save = el('button', { type: 'button', class: 'primary' }, 'Save settings');
  const test = el('button', { type: 'button', class: 'secondary' }, 'Test connection');
  const release = el('button', { type: 'button', class: 'secondary' }, 'Release contest queue');
  const retry = el('button', { type: 'button', class: 'secondary' }, 'Retry failed');
  const dashboard = el('button', { type: 'button', class: 'secondary' }, 'Dashboard');
  const disconnect = el('button', { type: 'button', class: 'secondary' }, 'Clear token');
  buttons.append(save, test, release, retry, dashboard, disconnect); form.append(buttons);
  const note = el('p', { class: 'note' }, 'Automatic sync remains paused until you check the consent box. PAT is stored in chrome.storage.session and cleared when the browser session ends. Use a fine-grained token restricted to this repository with Contents: Read and write.');
  form.append(note);
  root.append(form);

  const status = el('div', { class: 'feedback', 'aria-live': 'polite' }); root.append(status);
  const history = stateReply.state?.history ?? [];
  const queue = stateReply.state?.queue ?? [];
  const stats = el('section', { class: 'stats' });
  stats.append(el('div', { class: 'stat' }, `${history.filter((item) => item.status === 'synced').length} synced`));
  stats.append(el('div', { class: 'stat' }, `${queue.length} queued / held`));
  stats.append(el('div', { class: 'stat' }, `${history.filter((item) => item.status === 'failed').length} failed`));
  root.append(stats);

  const historyTitle = el('h2', {}, 'Recent activity'); root.append(historyTitle);
  const list = el('div', { class: 'history' });
  history.slice(0, 5).forEach((item) => {
    const row = el('div', { class: 'history-row' });
    const title = el('strong', {}, item.problemTitle || item.submissionId);
    const meta = el('small', {}, `${item.status} · ${new Date(item.createdAt).toLocaleString()}`);
    row.append(title, meta);
    if (item.message) row.append(el('small', {}, item.message));
    list.append(row);
  });
  if (!history.length) list.append(el('p', { class: 'empty' }, 'No accepted submissions synced yet.'));
  root.append(list);

  save.addEventListener('click', async () => {
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
      status.textContent = saved.message ?? 'Saved.';
      status.dataset.kind = 'good';
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Save failed.'; status.dataset.kind = 'bad'; }
  });
  test.addEventListener('click', async () => {
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
      status.textContent = result.message ?? 'Connection successful.';
      status.dataset.kind = 'good';
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Connection test failed.'; status.dataset.kind = 'bad'; }
  });
  release.addEventListener('click', async () => {
    const result = await send({ type: 'RELEASE_CONTEST_QUEUE' });
    status.textContent = result.message ?? 'Queue released.';
    status.dataset.kind = result.ok ? 'good' : 'bad';
  });
  retry.addEventListener('click', async () => {
    const result = await send({ type: 'RETRY_FAILED' });
    status.textContent = result.message ?? 'Retry attempted.';
    status.dataset.kind = result.ok ? 'good' : 'bad';
  });
  dashboard.addEventListener('click', () => { void chrome.tabs.create({ url: chrome.runtime.getURL('/dashboard.html') }); });
  disconnect.addEventListener('click', async () => {
    const result = await send({ type: 'CLEAR_TOKEN' });
    status.textContent = result.message ?? 'Token cleared.';
    status.dataset.kind = result.ok ? 'good' : 'bad';
  });
}

void render().catch((error) => { root.textContent = error instanceof Error ? error.message : 'BlinkSync failed to load.'; });
