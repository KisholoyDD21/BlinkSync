import { DEFAULT_CONFIG, MAX_HISTORY_ITEMS, STORAGE_KEYS } from '../shared/constants';
import type { BlinkConfig, QueueItem, ReviewRecord, SyncRecord } from '../shared/types';

export async function initStorageAccess(): Promise<void> {
  // Keep extension storage unavailable to content scripts by default.
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

export async function getConfig(): Promise<BlinkConfig> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.config);
  return { ...DEFAULT_CONFIG, ...(result[STORAGE_KEYS.config] as Partial<BlinkConfig> | undefined) };
}

export async function saveConfig(config: BlinkConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: config });
}

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.session.get('githubToken');
  return typeof result.githubToken === 'string' ? result.githubToken : null;
}

export async function saveToken(token: string): Promise<void> {
  await chrome.storage.session.set({ githubToken: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.session.remove('githubToken');
}

const QUEUE_DB_NAME = 'blinksync-local';
const QUEUE_DB_VERSION = 1;
const QUEUE_STORE = 'pending-submissions';
let queueDbPromise: Promise<IDBDatabase> | undefined;

function openQueueDb(): Promise<IDBDatabase> {
  if (queueDbPromise) return queueDbPromise;
  queueDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open BlinkSync IndexedDB queue.'));
    request.onblocked = () => reject(new Error('BlinkSync queue database upgrade is blocked by another extension context.'));
  }).catch((error) => {
    queueDbPromise = undefined;
    throw error;
  });
  return queueDbPromise!;
}

export async function getQueue(): Promise<QueueItem[]> {
  const db = await openQueueDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const request = tx.objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueueItem[]).sort((a, b) => a.nextAttemptAt - b.nextAttemptAt));
    request.onerror = () => reject(request.error ?? new Error('Could not read BlinkSync retry queue.'));
    tx.onabort = () => reject(tx.error ?? new Error('BlinkSync queue read was aborted.'));
  });
}

export async function upsertQueueItem(item: QueueItem): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not update BlinkSync retry queue.'));
    tx.onabort = () => reject(tx.error ?? new Error('BlinkSync queue update was aborted.'));
  });
}

export async function removeQueueItem(key: string): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not remove BlinkSync queue item.'));
    tx.onabort = () => reject(tx.error ?? new Error('BlinkSync queue removal was aborted.'));
  });
}

export async function getHistory(): Promise<SyncRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.history);
  return Array.isArray(result[STORAGE_KEYS.history]) ? result[STORAGE_KEYS.history] as SyncRecord[] : [];
}

let historyMutation = Promise.resolve();
export function addHistory(record: SyncRecord): Promise<void> {
  const operation = historyMutation.then(async () => {
    const history = await getHistory();
    const next = [record, ...history.filter((item) => item.key !== record.key)].slice(0, MAX_HISTORY_ITEMS);
    await chrome.storage.local.set({ [STORAGE_KEYS.history]: next });
  });
  historyMutation = operation.catch(() => undefined);
  return operation;
}

export async function hasCompleted(key: string): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ledger);
  const ledger = (result[STORAGE_KEYS.ledger] ?? {}) as Record<string, number>;
  return Boolean(ledger[key]);
}

let ledgerMutation = Promise.resolve();
export function markCompleted(key: string): Promise<void> {
  const operation = ledgerMutation.then(async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ledger);
    const ledger = (result[STORAGE_KEYS.ledger] ?? {}) as Record<string, number>;
    ledger[key] = Date.now();
    const entries = Object.entries(ledger).sort((a, b) => b[1] - a[1]).slice(0, 2_000);
    await chrome.storage.local.set({ [STORAGE_KEYS.ledger]: Object.fromEntries(entries) });
  });
  ledgerMutation = operation.catch(() => undefined);
  return operation;
}

export async function getReviews(): Promise<ReviewRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.reviews);
  return Array.isArray(result[STORAGE_KEYS.reviews]) ? result[STORAGE_KEYS.reviews] as ReviewRecord[] : [];
}

export async function saveReviews(items: ReviewRecord[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.reviews]: items.slice(0, 2_000) });
}
