const EXTENSIONS: Record<string, string> = {
  'python': 'py', 'python3': 'py', 'python 2': 'py', 'python 3': 'py', 'pandas': 'py',
  'cpp': 'cpp', 'c++': 'cpp', 'c++14': 'cpp', 'c++17': 'cpp', 'c++20': 'cpp',
  'java': 'java', 'java 8': 'java', 'java 14': 'java', 'java 17': 'java',
  'javascript': 'js', 'javascript 30': 'js', 'typescript': 'ts',
  'c': 'c', 'c#': 'cs', 'csharp': 'cs', 'go': 'go', 'golang': 'go',
  'rust': 'rs', 'ruby': 'rb', 'php': 'php', 'kotlin': 'kt', 'swift': 'swift',
  'scala': 'scala', 'dart': 'dart', 'elixir': 'ex', 'erlang': 'erl',
  'clojure': 'clj', 'racket': 'rkt', 'mysql': 'sql', 'mssql': 'sql',
  'ms sql server': 'sql', 'oracle': 'sql', 'postgresql': 'sql',
  'bash': 'sh', 'shell': 'sh', 'powershell': 'ps1', 'perl': 'pl',
  'lua': 'lua', 'haskell': 'hs', 'ocaml': 'ml', 'f#': 'fs',
};

export function extensionForLanguage(language: string): string {
  const normalized = language.trim().toLowerCase().replace(/\s+/g, ' ');
  return EXTENSIONS[normalized] ?? 'txt';
}
