import React, { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🌳 GitMindHub</h1>
      <p>Git-style context visualization chatbox</p>
      <p>Platform: {window.gitmindhub?.platform || 'unknown'}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Clicked {count} times
      </button>
    </div>
  )
}

export default App
