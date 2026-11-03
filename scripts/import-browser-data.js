// Optional migration helper. Run in the NEW app's browser console, then choose
// a file made by export-browser-data.js. No requests or notifications are sent.
(() => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup is too large');
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'domain-studio-browser-backup' || backup.version !== 1
        || !backup.storage || typeof backup.storage !== 'object' || Array.isArray(backup.storage)) throw new Error('Invalid backup format');
      const entries = Object.entries(backup.storage).filter(([key]) => key !== 'dh:v1:server-watches').map(([key, value]) => {
        if (key === 'dh:v1:settings' && typeof value === 'string') {
          const settings = JSON.parse(value); delete settings.githubToken;
          return [key, JSON.stringify(settings)];
        }
        return [key, value];
      });
      for (const [key, value] of entries) {
        if (!key.startsWith('dh:v1:') || typeof value !== 'string') throw new Error('Invalid storage entry');
        JSON.parse(value);
      }
      if (!confirm(`Import ${entries.length} entries from your old Domain-Hunter browser backup? Matching entries in this browser will be replaced.`)) return;
      const previous = new Map(entries.map(([key]) => [key, localStorage.getItem(key)]));
      try { for (const [key, value] of entries) localStorage.setItem(key, value); }
      catch (error) {
        for (const [key, value] of previous) {
          if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        }
        throw error;
      }
      location.reload();
    } catch (error) { console.error('Import failed:', error); }
  };
  input.click();
})();
