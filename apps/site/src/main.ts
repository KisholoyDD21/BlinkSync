import './style.css';

const ua = navigator.userAgent;
const browserMessage = document.querySelector<HTMLElement>('#browser-message');
const download = document.querySelector<HTMLAnchorElement>('#download');
const chromeLink = document.querySelector<HTMLAnchorElement>('#chrome-link');
const firefoxLink = document.querySelector<HTMLAnchorElement>('#firefox-link');
const chromeStoreUrl = import.meta.env.VITE_CHROME_STORE_URL || 'https://github.com/KisholoyDD21/BlinkSync/releases/latest';
const firefoxStoreUrl = import.meta.env.VITE_FIREFOX_ADDON_URL || 'https://github.com/KisholoyDD21/BlinkSync/releases/latest';

const updateDownloadText = (text: string) => {
  if (!download) return;
  const label = download.querySelector<HTMLElement>('.btn-text');
  if (label) label.textContent = text;
  else download.textContent = text;
};

if (chromeLink) chromeLink.href = chromeStoreUrl;
if (firefoxLink) firefoxLink.href = firefoxStoreUrl;

if (/Firefox\//.test(ua)) {
  if (browserMessage) browserMessage.textContent = 'Firefox detected. Use the signed Firefox build.';
  if (download) {
    download.href = firefoxStoreUrl;
    updateDownloadText('Add to Firefox — It’s Free');
  }
} else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
  if (browserMessage) browserMessage.textContent = 'Chromium detected. Direct install via Chrome Web Store or signed release.';
  if (download) {
    download.href = chromeStoreUrl;
    updateDownloadText('Add to Chrome — It’s Free');
  }
} else if (browserMessage) {
  browserMessage.textContent = 'Choose your browser package below.';
}

// ─── Cookie Consent Banner ───
const banner = document.querySelector<HTMLElement>('#cookie-banner');
const acceptBtn = document.querySelector<HTMLButtonElement>('#cookie-accept');

if (banner && acceptBtn) {
  const consentGiven = localStorage.getItem('blinksync_cookie_consent');
  if (!consentGiven) {
    // Show banner after brief delay
    setTimeout(() => {
      banner.classList.remove('hidden');
    }, 800);
  }

  acceptBtn.addEventListener('click', () => {
    localStorage.setItem('blinksync_cookie_consent', 'true');
    banner.classList.add('hidden');
  });
}

// ─── Privacy-Preserving Analytics (Zero-Cookie, Respects Do-Not-Track) ───
const logPageView = () => {
  if (navigator.doNotTrack === '1') return;
  // Lightweight client-side session ping
  const page = window.location.pathname;
  if (window.console && import.meta.env.DEV) {
    console.debug(`[BlinkSync Privacy Analytics] Page view: ${page}`);
  }
};

logPageView();
