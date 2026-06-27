import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

declare global {
  interface Window { __STARTUP_TIMING__?: Record<string, number> }
}

const __t0 = performance.now()
window.__STARTUP_TIMING__ = window.__STARTUP_TIMING__ || {}
window.__STARTUP_TIMING__.moduleExec = __t0

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Report timing after mount
setTimeout(() => {
  const w = window as any
  const timings = w.__STARTUP_TIMING__ || {}
  timings.reportTime = performance.now()
  const marks = performance.getEntriesByType('mark')
  for (const m of marks) {
    timings[m.name] = m.startTime
  }
  // Send to backend (absolute URL to work from any origin)
  fetch('http://127.0.0.1:8000/api/timing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(timings),
  }).catch(() => {})
  // Also print to console
  console.log('=== STARTUP TIMING ===')
  for (const [k, v] of Object.entries(timings)) {
    console.log(`  ${k}: ${v}ms`)
  }
  console.log('=== END STARTUP TIMING ===')
}, 2000)
