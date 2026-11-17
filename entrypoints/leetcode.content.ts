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
      toast.className = 'blinksync-inpage-toast';
      
      const iconUrl = (() => {
        try {
          return chrome.runtime.getURL('/icon/32.png');
        } catch {
          return null;
        }
      })();

      toast.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          ${iconUrl ? `<img src="${iconUrl}" style="width:20px;height:20px;border-radius:5px;flex-shrink:0;" alt="BlinkSync" />` : '<span style="font-size:16px;">⚡</span>'}
          <span style="font-size:12px;font-weight:600;letter-spacing:-0.01em;line-height:1.4;">${message}</span>
        </div>
      `;

      Object.assign(toast.style, {
        position: 'fixed',
        right: '24px',
        bottom: '76px',
        zIndex: '2147483647',
        background: error ? 'rgba(35, 12, 16, 0.95)' : 'rgba(11, 16, 32, 0.95)',
        color: error ? '#fca5a5' : '#f8fafc',
        border: error ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
        padding: '11px 16px',
        borderRadius: '12px',
        font: '13px/1.4 Inter, system-ui, -apple-system, sans-serif',
        maxWidth: '360px',
        boxShadow: error 
          ? '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(239, 68, 68, 0.2)' 
          : '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(59, 130, 246, 0.25)',
        backdropFilter: 'blur(12px)',
        transform: 'translateY(10px)',
        opacity: '0',
        transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      });

      document.documentElement.append(toast);

      requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
      });

      window.setTimeout(() => {
        toast.style.transform = 'translateY(10px)';
        toast.style.opacity = '0';
        window.setTimeout(() => toast.remove(), 250);
      }, 4500);
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
        const reply = await chrome.runtime.sendMessage({ type: 'GET_REVIEW_STATUS', problemSlug: slug });
        const review = reply?.review;
        if (!reply?.ok || !review || !document.body || location.pathname.match(/^\/problems\/([^/]+)/)?.[1] !== slug || document.getElementById('blinksync-review')) return;
        const button = document.createElement('button');
        button.id = 'blinksync-review';
        button.dataset.slug = slug;
        button.type = 'button';
        button.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Review due · Mark done
          </span>
        `;
        Object.assign(button.style, {
          position: 'fixed',
          right: '18px',
          bottom: '64px',
          zIndex: '2147483646',
          border: '1px solid rgba(0, 184, 163, 0.4)',
          borderRadius: '999px',
          padding: '8px 14px',
          cursor: 'pointer',
          background: 'rgba(16, 27, 24, 0.95)',
          color: '#00b8a3',
          font: '600 11px Inter, system-ui, sans-serif',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3), 0 0 10px rgba(0, 184, 163, 0.2)',
          backdropFilter: 'blur(8px)',
          transition: 'all 150ms ease',
        });
        button.addEventListener('mouseenter', () => {
          button.style.background = '#00b8a3';
          button.style.color = '#0d1117';
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = 'rgba(16, 27, 24, 0.95)';
          button.style.color = '#00b8a3';
        });
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
      button.title = 'BlinkSync: Sync this submission to GitHub';

      const iconUrl = (() => {
        try {
          return chrome.runtime.getURL('/icon/32.png');
        } catch {
          return null;
        }
      })();

      button.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          ${iconUrl ? `<img src="${iconUrl}" style="width:16px;height:16px;border-radius:4px;" alt="BlinkSync" />` : '<span style="color:#ffa116;">⚡</span>'}
          <span>BlinkSync</span>
        </span>
      `;

      Object.assign(button.style, {
        position: 'fixed',
        right: '18px',
        bottom: '18px',
        zIndex: '2147483646',
        border: '1px solid #30363d',
        borderRadius: '999px',
        padding: '8px 14px',
        cursor: 'pointer',
        background: '#161b22',
        color: '#f0f6fc',
        font: '600 12px Inter, system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(255, 161, 22, 0.15)',
        backdropFilter: 'blur(8px)',
        transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      });

      button.addEventListener('mouseenter', () => {
        button.style.borderColor = '#ffa116';
        button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6), 0 0 16px rgba(255, 161, 22, 0.35)';
        button.style.transform = 'translateY(-1px)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.borderColor = '#30363d';
        button.style.boxShadow = '0 4px 16px rgba(0,0,0,0.5), 0 0 12px rgba(255, 161, 22, 0.15)';
        button.style.transform = 'translateY(0)';
      });

      button.addEventListener('click', async () => {
        const input = window.prompt('Paste the LeetCode submission URL or enter its numeric submission ID:');
        if (!input) return;
        const id = parseSubmissionId(input);
        if (!id) { showToast('Could not find a valid submission ID.', true); return; }
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
