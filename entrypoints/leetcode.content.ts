import { MAIN_WORLD_EVENT, MAIN_WORLD_REARM_EVENT } from '../src/shared/constants';
import { parseSubmissionId, validateCandidate } from '../src/shared/validators';

export default defineContentScript({
  matches: ['https://leetcode.com/problems/*', 'https://leetcode.com/contest/*'],
  runAt: 'document_start',
  allFrames: false,
  async main(ctx) {
    let lastSubmissionId: string | null = null;
    let lastDomSignalAt = 0;
    let domFallbackTimer: number | undefined;

    const discoverSubmissionId = (): string | null => {
      const fromPath = location.pathname.match(/\/submissions\/(?:detail\/)?(\d{1,20})\/?/i)?.[1];
      if (fromPath) return fromPath;
      const dataId = document.querySelector<HTMLElement>('[data-submission-id]')?.dataset.submissionId;
      if (dataId && /^\d{1,20}$/.test(dataId)) return dataId;
      const href = [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/submissions/"]')]
        .map((anchor) => anchor.href)
        .find((value) => /\/submissions\/(?:detail\/)?\d+/i.test(value));
      return href ? parseSubmissionId(href) : null;
    };

    const showToast = (message: string, error = false) => {
      const toast = document.createElement('div');
      toast.textContent = message;
      Object.assign(toast.style, {
        position: 'fixed', right: '18px', bottom: '68px', zIndex: '2147483647',
        background: error ? '#7f1d1d' : '#111827', color: '#fff', padding: '10px 14px',
        borderRadius: '10px', font: '13px/1.4 system-ui,sans-serif', maxWidth: '320px',
        boxShadow: '0 8px 28px rgba(0,0,0,.25)',
      });
      document.documentElement.append(toast);
      window.setTimeout(() => toast.remove(), 4500);
    };

    const submitCandidate = async (submissionId: string, source: 'network' | 'dom' | 'manual') => {
      const candidate = { submissionId, observedAt: Date.now(), source } as const;
      if (!validateCandidate(candidate)) return;
      showToast('Accepted detected · verifying submission…');
      try {
        const reply = await chrome.runtime.sendMessage({ type: 'SUBMISSION_ACCEPTED', candidate });
        if (!reply?.ok) throw new Error(reply?.message ?? 'BlinkSync rejected the submission event.');
        const failed = reply.record?.status === 'failed';
        showToast(reply.message ?? (failed ? 'Sync failed.' : 'BlinkSync processed the submission.'), failed);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'BlinkSync could not contact its service worker.', true);
      }
    };

    window.addEventListener(MAIN_WORLD_EVENT, (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; submissionId?: string }>).detail;
      if (!detail || typeof detail.submissionId !== 'string') return;
      if (detail.kind === 'submission-start') lastSubmissionId = detail.submissionId;
      if (detail.kind === 'accepted') {
        lastSubmissionId = detail.submissionId;
        void submitCandidate(detail.submissionId, 'network');
      }
    });

    // Install the receiver before injecting the MAIN-world bridge so no early event is lost.
    // If the page's CSP blocks injection, DOM and manual fallbacks remain active.
    void injectScript('/leetcode-main-world.js', { keepInDom: true }).catch((error) => {
      console.warn('[BlinkSync] Main-world detector unavailable; using fallback detection.', error);
    });

    // Fallback only: semantic locator can change and is not a source of truth.
    let observer: MutationObserver | null = null;
    const armDomFallback = () => {
      if (observer || !document.body) return;
      observer = new MutationObserver(() => {
        // Debounce DOM churn; the network bridge remains the primary detector.
        if (domFallbackTimer !== undefined) window.clearTimeout(domFallbackTimer);
        domFallbackTimer = window.setTimeout(() => {
          domFallbackTimer = undefined;
          const result = document.querySelector<HTMLElement>('[data-e2e-locator="submission-result"]');
          if (!result || !/\baccepted\b/i.test(result.textContent ?? '')) return;
          const submissionId = lastSubmissionId ?? discoverSubmissionId();
          if (!submissionId || Date.now() - lastDomSignalAt < 2_000) return;
          lastSubmissionId = submissionId;
          lastDomSignalAt = Date.now();
          void submitCandidate(submissionId, 'dom');
        }, 120);
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    };
    // Manual safety net. User supplies the submission URL or numeric ID.
    const installReviewButton = async () => {
      const slug = location.pathname.match(/^\/problems\/([^/]+)/)?.[1];
      if (!slug) return;
      const currentButton = document.getElementById('blinksync-review') as HTMLButtonElement | null;
      if (currentButton?.dataset.slug === slug) return;
      currentButton?.remove();
      try {
        // Only request this page's due status; never expose settings/history/token state to a content script.
        const reply = await chrome.runtime.sendMessage({ type: 'GET_REVIEW_STATUS', problemSlug: slug });
        const review = reply?.review;
        if (!reply?.ok || !review || !document.body || location.pathname.match(/^\/problems\/([^/]+)/)?.[1] !== slug || document.getElementById('blinksync-review')) return;
        const button = document.createElement('button');
        button.id = 'blinksync-review';
        button.dataset.slug = slug;
        button.type = 'button';
        button.textContent = 'Review due · mark complete';
        Object.assign(button.style, { position: 'fixed', right: '18px', bottom: '60px', zIndex: '2147483646', border: '1px solid #166534', borderRadius: '999px', padding: '9px 14px', cursor: 'pointer', background: '#14532d', color: '#fff', font: '600 12px system-ui,sans-serif' });
        button.addEventListener('click', async () => {
          try {
            const reply = await chrome.runtime.sendMessage({ type: 'MARK_REVIEWED', problemSlug: slug, rating: 'good' });
            if (!reply?.ok) throw new Error(reply?.message ?? 'Could not update the review schedule.');
            showToast(reply.message ?? 'Review updated.');
            button.remove();
          } catch (error) {
            showToast(error instanceof Error ? error.message : 'Review update failed.', true);
          }
        });
        document.body.append(button);
      } catch { /* dashboard review list remains available if inline UI cannot mount */ }
    };

    const installManualButton = () => {
      if (!document.body || document.getElementById('blinksync-manual')) return;
      const button = document.createElement('button');
      button.id = 'blinksync-manual';
      button.type = 'button';
      button.textContent = 'BlinkSync';
      Object.assign(button.style, {
        position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483646',
        border: '0', borderRadius: '999px', padding: '10px 16px', cursor: 'pointer',
        background: '#2563eb', color: '#fff', font: '600 13px system-ui,sans-serif',
        boxShadow: '0 5px 18px rgba(37,99,235,.35)',
      });
      button.addEventListener('click', async () => {
        const input = window.prompt('Paste the LeetCode submission URL or enter its submission ID:');
        if (!input) return;
        const id = parseSubmissionId(input);
        if (!id) { showToast('Could not find a submission ID in that value.', true); return; }
        try {
          const reply = await chrome.runtime.sendMessage({ type: 'SYNC_MANUAL', submissionId: id });
          if (!reply?.ok) throw new Error(reply?.message ?? 'Manual sync was rejected.');
          const failed = reply.record?.status === 'failed';
          showToast(reply.message ?? 'Manual sync processed.', failed);
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Manual sync failed.', true);
        }
      });
      document.body.append(button);
    };
    const onPageReady = () => {
      window.dispatchEvent(new Event(MAIN_WORLD_REARM_EVENT));
      armDomFallback();
      installManualButton();
      void installReviewButton();
    };
    if (document.body) onPageReady();
    else {
      const bodyObserver = new MutationObserver(() => {
        if (!document.body) return;
        bodyObserver.disconnect();
        onPageReady();
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      const supportedRoute = /^\/(?:problems|contest)\//.test(location.pathname);
      if (supportedRoute) onPageReady();
      else {
        observer?.disconnect();
        observer = null;
        if (domFallbackTimer !== undefined) window.clearTimeout(domFallbackTimer);
        domFallbackTimer = undefined;
        lastSubmissionId = null;
        document.getElementById('blinksync-review')?.remove();
        document.getElementById('blinksync-manual')?.remove();
      }
    });
    ctx.addEventListener(window, 'online', () => {
      void chrome.runtime.sendMessage({ type: 'FLUSH_QUEUE' }).catch(() => undefined);
    });
  },
});
