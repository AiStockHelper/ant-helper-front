;(function () {
  try {
    var mode = localStorage.getItem('ant.theme') || 'system'
    var dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    var el = document.documentElement
    if (dark) el.classList.add('dark')
    el.style.colorScheme = dark ? 'dark' : 'light'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#0b0d12' : '#f7f8fa')
  } catch (e) {}
})()
