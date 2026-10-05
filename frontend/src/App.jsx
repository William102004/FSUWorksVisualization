import { drawNetwork } from './network'
import { useEffect, useRef, useState } from 'react';
import './App.css'

const API_BASE = "http://127.0.0.1:5001";

function App() {
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const viewRef = useRef(null)
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE}/api/network`)
    .then(response => {
      if(!response.ok) throw new Error (`HTTP ${response.status}`)
        return response.json()
    })
    .then(data => {
      if(cancelled) return
      setStatus(`${data.nodes.length} papers, ${data.links.length} links. Now setting`)
      viewRef.current = drawNetwork(svgRef.current, data, {
        tooltip: tooltipRef.current, onSettled: () => setStatus("ready"),
      })
    })
    .catch(err => {
      if (!cancelled)
        setStatus(`Error: ${err.message}. Error. Please check server is running`)
    });

    return() => {
      cancelled = true
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [])
  return (
    <main>
      <h1>Citation Network Visualization in FSU (WMA23, William Almaguer)</h1>
      <p>{status}</p>
      <button onClick={() => viewRef.current?.fitToView()}>Fit-To-View</button>
      <svg ref={svgRef} className="network" />
      <div ref={tooltipRef} className="tooltip" />
    </main>
  )

}

export default App
