import './style.css';

const ua = navigator.userAgent;
const browserMessage = document.querySelector<HTMLElement>('#browser-message');
const download = document.querySelector<HTMLAnchorElement>('#download');
const chromeLink = document.querySelector<HTMLAnchorElement>('#chrome-link');
const firefoxLink = document.querySelector<HTMLAnchorElement>('#firefox-link');
const chromeStoreUrl = import.meta.env.VITE_CHROME_STORE_URL || 'https://github.com/KisholoyDD21/BlinkSync/releases/latest';
const firefoxStoreUrl = import.meta.env.VITE_FIREFOX_ADDON_URL || 'https://github.com/KisholoyDD21/BlinkSync/releases/latest';

if (chromeLink) chromeLink.href = chromeStoreUrl;
if (firefoxLink) firefoxLink.href = firefoxStoreUrl;
if (/Firefox\//.test(ua)) {
  if (browserMessage) browserMessage.textContent = 'Firefox detected. Use the Firefox build.';
  if (download) { download.href = firefoxStoreUrl; download.textContent = 'Get Firefox build'; }
} else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) {
  if (browserMessage) browserMessage.textContent = 'Chrome detected. Use the Chrome Web Store or signed release package.';
  if (download) { download.href = chromeStoreUrl; download.textContent = 'Get BlinkSync for Chrome'; }
} else if (browserMessage) {
  browserMessage.textContent = 'Browser not identified. Choose a supported build below.';
}
