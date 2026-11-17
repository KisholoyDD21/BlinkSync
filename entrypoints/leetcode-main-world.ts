import { MAIN_WORLD_EVENT, MAIN_WORLD_REARM_EVENT } from '../src/shared/constants';

export default defineUnlistedScript(() => {
  const eventName = MAIN_WORLD_EVENT;
  const wrappedMarker = '__blinksyncWrapped';
  let lastSeenSubmissionId: string | null = null;
  const seenAccepted = new Set<string>();

  const emit = (detail: { kind: 'submission-start' | 'accepted'; submissionId: string }) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  function isTargetRoute(): boolean {
    return /^\/(?:problems|contest)\//.test(location.pathname);
  }

  function getSubmissionId(url: string): string | null {
    const match = url.match(/\/submissions\/detail\/(\d+)(?:\/check)?\/?/i);
    return match?.[1] ?? null;
  }

  function looksAccepted(value: unknown, depth = 0): boolean {
    if (!value || typeof value !== 'object' || depth > 5) return false;
    if (Array.isArray(value)) return value.some((item) => looksAccepted(item, depth + 1));
    const result = value as Record<string, unknown>;
    if (result.status_msg === 'Accepted' || result.statusDisplay === 'Accepted' || Number(result.status_code ?? result.statusCode) === 10) return true;
    return Object.values(result).some((item) => looksAccepted(item, depth + 1));
  }

  function idFromGraphqlBody(body: unknown): string | null {
    if (typeof body !== 'string') return null;
    try {
      const json = JSON.parse(body) as { operationName?: string; variables?: Record<string, unknown> };
      if (!/check|submission/i.test(json.operationName ?? '')) return null;
      const id = json.variables?.submissionId ?? json.variables?.submission_id ?? json.variables?.id;
      return id == null ? null : String(id).match(/^\d{1,20}$/)?.[0] ?? null;
    } catch { return null; }
  }

  function inspect(url: string, payload: unknown, requestSubmissionId: string | null): void {
    if (!isTargetRoute()) return;
    // Keep the ID bound to this individual request; concurrent submissions must not
    // inherit whichever ID happened to be observed most recently in the page.
    const submissionId = getSubmissionId(url) ?? requestSubmissionId ?? lastSeenSubmissionId;
    if (!submissionId) return;
    if (getSubmissionId(url)) {
      lastSeenSubmissionId = submissionId;
      emit({ kind: 'submission-start', submissionId });
    }
    if (looksAccepted(payload) && !seenAccepted.has(submissionId)) {
      seenAccepted.add(submissionId);
      emit({ kind: 'accepted', submissionId });
      if (seenAccepted.size > 100) seenAccepted.clear();
    }
  }

  function installFetchObserver(): void {
    type MarkedFetch = typeof window.fetch & { [wrappedMarker]?: boolean };
    const currentFetch = window.fetch as MarkedFetch;
    if (currentFetch[wrappedMarker]) return;
    const originalFetch = currentFetch;
    const wrappedFetch: MarkedFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const response = await Reflect.apply(originalFetch, window, args) as Response;
      try {
        if (!isTargetRoute()) return response;
        const request = args[0];
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        const init = args[1];
        const body: unknown = init?.body;
        const graphqlId = idFromGraphqlBody(body);
        const id = getSubmissionId(url) ?? graphqlId;
        const isSubmissionCheck = /submissions\/detail\/\d+\/check/i.test(url) || (url.includes('/graphql') && id !== null);
        if (isSubmissionCheck) {
          if (id) { lastSeenSubmissionId = id; emit({ kind: 'submission-start', submissionId: id }); }
          const requestSubmissionId = id ?? lastSeenSubmissionId;
          void response.clone().json().then((json: unknown) => inspect(url, json, requestSubmissionId)).catch(() => undefined);
        }
      } catch { /* instrumentation must never change the page's fetch result */ }
      return response;
    };
    Object.defineProperty(wrappedFetch, wrappedMarker, { value: true });
    window.fetch = wrappedFetch;
  }

  function installXhrObserver(): void {
    const prototype = XMLHttpRequest.prototype;
    type MarkedOpen = typeof prototype.open & { [wrappedMarker]?: boolean };
    type MarkedSend = typeof prototype.send & { [wrappedMarker]?: boolean };

    const currentOpen = prototype.open as MarkedOpen;
    if (!currentOpen[wrappedMarker]) {
      type XHROpen = (this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) => void;
      const originalOpen = currentOpen as XHROpen;
      const wrappedOpen: XHROpen & { [wrappedMarker]?: boolean } = function (this: XMLHttpRequest, method, url, async = true, username, password) {
        (this as XMLHttpRequest & { __blinkUrl?: string }).__blinkUrl = String(url);
        return originalOpen.call(this, method, url, async, username, password);
      };
      Object.defineProperty(wrappedOpen, wrappedMarker, { value: true });
      prototype.open = wrappedOpen as typeof prototype.open;
    }

    const currentSend = prototype.send as MarkedSend;
    if (!currentSend[wrappedMarker]) {
      type XHRSend = (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) => void;
      const originalSend = currentSend as XHRSend;
      const wrappedSend: XHRSend & { [wrappedMarker]?: boolean } = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
        const xhr = this as XMLHttpRequest & { __blinkUrl?: string };
        const url = xhr.__blinkUrl ?? '';
        if (isTargetRoute()) {
          const graphqlId = idFromGraphqlBody(body);
          const id = getSubmissionId(url) ?? graphqlId;
          const isSubmissionCheck = /submissions\/detail\/\d+\/check/i.test(url) || (url.includes('/graphql') && id !== null);
          if (isSubmissionCheck) {
            if (id) { lastSeenSubmissionId = id; emit({ kind: 'submission-start', submissionId: id }); }
            const requestSubmissionId = id ?? lastSeenSubmissionId;
            xhr.addEventListener('load', () => {
              try { inspect(url, JSON.parse(xhr.responseText) as unknown, requestSubmissionId); } catch { /* response may not be JSON */ }
            }, { once: true });
          }
        }
        return originalSend.call(this, body as XMLHttpRequestBodyInit | null | undefined);
      };
      Object.defineProperty(wrappedSend, wrappedMarker, { value: true });
      prototype.send = wrappedSend as typeof prototype.send;
    }
  }

  function armObservers(): void {
    // SPA transitions can replace page APIs. Rewrap only when the page has replaced them.
    installFetchObserver();
    installXhrObserver();
  }

  armObservers();
  window.addEventListener(MAIN_WORLD_REARM_EVENT, armObservers);
});
