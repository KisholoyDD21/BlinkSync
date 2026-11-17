/**
 * Professional SVG icons for BlinkSync UI (Popup, Dashboard, Content Script, Site).
 * All icons use `currentColor` and scalable viewBox for crisp rendering at any size.
 */

export function svgIcon(path: string, size = 16, viewBox = '0 0 24 24', extraClass = ''): string {
  return `<svg class="svg-icon ${extraClass}" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function fillSvgIcon(path: string, size = 16, viewBox = '0 0 24 24', extraClass = ''): string {
  return `<svg class="svg-icon ${extraClass}" width="${size}" height="${size}" viewBox="${viewBox}" fill="currentColor" aria-hidden="true">${path}</svg>`;
}

// GitHub Mark (Official Octocat silhouette)
export const GITHUB_ICON = (size = 16) => fillSvgIcon(
  `<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>`,
  size,
  '0 0 24 24',
  'icon-github'
);

// LeetCode Mark
export const LEETCODE_ICON = (size = 16) => fillSvgIcon(
  `<path d="M16.102 17.93l-2.697 2.607c-.466.467-1.111.662-1.823.662s-1.357-.195-1.824-.662l-4.332-4.363c-.467-.467-.702-1.15-.702-1.863s.235-1.357.702-1.824l4.319-4.38c.467-.467 1.125-.645 1.837-.645s1.357.195 1.823.662l2.697 2.606c.514.515 1.365.497 1.9-.038.535-.536.553-1.387.039-1.901l-2.609-2.636a5.216 5.216 0 0 0-3.85-1.439c-1.492 0-2.883.585-3.889 1.591L3.376 12.44A5.46 5.46 0 0 0 1.785 16.3c0 1.492.591 2.883 1.591 3.889l4.332 4.363c1.006 1.006 2.397 1.591 3.889 1.591s2.883-.585 3.889-1.591l2.609-2.636c.514-.515.496-1.366-.039-1.902-.535-.535-1.423-.497-1.954.016zm3.924-4.887H8.489a1.366 1.366 0 0 0-1.366 1.366c0 .754.612 1.366 1.366 1.366h11.537c.754 0 1.366-.612 1.366-1.366 0-.754-.612-1.366-1.366-1.366z"/>`,
  size,
  '0 0 24 24',
  'icon-leetcode'
);

// Navigation / Tabs
export const OVERVIEW_ICON = (size = 16) => svgIcon(
  `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>`,
  size
);

export const SETTINGS_ICON = (size = 16) => svgIcon(
  `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
  size
);

export const ACTIVITY_ICON = (size = 16) => svgIcon(
  `<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>`,
  size
);

// Actions
export const SAVE_ICON = (size = 16) => svgIcon(
  `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`,
  size
);

export const TEST_ICON = (size = 16) => svgIcon(
  `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  size
);

export const RETRY_ICON = (size = 16) => svgIcon(
  `<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/>`,
  size
);

export const RELEASE_ICON = (size = 16) => svgIcon(
  `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  size
);

export const DASHBOARD_ICON = (size = 16) => svgIcon(
  `<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>`,
  size
);

export const TRASH_ICON = (size = 16) => svgIcon(
  `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
  size
);

export const SEARCH_ICON = (size = 16) => svgIcon(
  `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  size
);

export const BOOK_ICON = (size = 16) => svgIcon(
  `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  size
);

export const CHECK_ICON = (size = 16) => svgIcon(
  `<polyline points="20 6 9 17 4 12"/>`,
  size
);

export const LOCK_ICON = (size = 16) => svgIcon(
  `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  size
);

export const SHIELD_ICON = (size = 16) => svgIcon(
  `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  size
);

export const CODE_ICON = (size = 16) => svgIcon(
  `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`,
  size
);

export const GIT_COMMIT_ICON = (size = 16) => svgIcon(
  `<circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/>`,
  size
);
