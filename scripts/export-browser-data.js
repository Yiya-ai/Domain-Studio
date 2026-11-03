// Optional migration helper. Run in the OLD app's browser console.
// This only downloads local browser data; it makes no network requests.
(() => {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('dh:v1:') || key === 'dh:v1:server-watches') continue;
    const value = localStorage.getItem(key);
    if (key === 'dh:v1:settings') {
      const settings = JSON.parse(value || '{}');
      delete settings.githubToken;
      storage[key] = JSON.stringify(settings);
    } else storage[key] = value;
  }
  const blob = new Blob([JSON.stringify({ format: 'domain-studio-browser-backup', version: 1, storage }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'domain-studio-browser-backup.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  console.info(`Exported ${Object.keys(storage).length} local entries. GitHub tokens and server-watch credentials are excluded. Domain history remains private.`);
})();
