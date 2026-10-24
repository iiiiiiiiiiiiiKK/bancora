// Applies the stored theme before first paint to avoid a flash of the wrong
// theme. Kept as an external file so the site can ship a strict CSP without
// 'unsafe-inline' for scripts.
(function () {
  try {
    var stored = localStorage.getItem('bancora.theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = stored === 'dark' || stored === 'light' ? stored : prefersDark ? 'dark' : 'light';
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
  }
})();
