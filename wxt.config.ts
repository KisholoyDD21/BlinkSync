import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'BlinkSync — LeetCode to GitHub',
    description: 'Reliably sync verified LeetCode Accepted submissions to your GitHub repository.',
    version: '0.1.0',
    permissions: ['storage', 'alarms'],
    host_permissions: [
      'https://leetcode.com/*',
      'https://api.github.com/*',
    ],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    action: {
      default_title: 'Open BlinkSync',
      default_popup: 'popup.html',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: ['leetcode-main-world.js', 'icon/*'],
        matches: ['https://leetcode.com/*'],
      },
    ],
  },
  vite: () => ({
    build: {
      minify: 'esbuild',
      sourcemap: false,
      target: 'es2022',
    },
  }),
});
