import { useCallback, useEffect, useMemo, useState } from 'react'
import { Device } from '@twilio/voice-sdk'
import './App.css'

const resolveDefaultTokenEndpoint = () => {
  if (typeof window === 'undefined') {
    return '/api/token'
  }

  return window.location.origin.includes('localhost')
    ? 'http://localhost:3001/token'
    : '/api/token'
}

const envTokenEndpoint = import.meta.env.VITE_TOKEN_ENDPOINT

const tokenEndpoint = envTokenEndpoint && !envTokenEndpoint.includes('localhost:3001')
  ? envTokenEndpoint
  : resolveDefaultTokenEndpoint()
const defaultIdentity = import.meta.env.VITE_TWILIO_DEFAULT_IDENTITY || 'clickup-agent'

function App() {
  const [device, setDevice] = useState(null)
  const [connection, setConnection] = useState(null)
  const [status, setStatus] = useState('idle')
  const [identity, setIdentity] = useState(defaultIdentity)
  const [number, setNumber] = useState('')
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const appendLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [{ message, timestamp }, ...prev])
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryNumber = params.get('number')
    if (queryNumber) {
      setNumber(queryNumber)
      appendLog(`Pre-filled number from URL: ${queryNumber}`)
    }
  }, [appendLog])

  useEffect(() => {
    return () => {
      if (device) {
        device.destroy()
      }
    }
  }, [device])

  const registerDeviceEvents = useCallback((dev) => {
    dev.on('registered', () => {
      setStatus('ready')
      appendLog('Device registered with Twilio')
    })
    dev.on('unregistered', () => appendLog('Device unregistered'))
    dev.on('error', (err) => {
      const message = err?.message || 'Unknown Twilio error'
      appendLog(`Device error: ${message}`)
      setError(message)
      setStatus('error')
    })
    dev.on('incoming', (incomingConnection) => {
      appendLog('Incoming call received')
      setConnection(incomingConnection)
      setStatus('incoming')
    })
    dev.on('cancel', () => {
      appendLog('Incoming call cancelled')
      setStatus('ready')
      setConnection(null)
    })
    dev.on('connect', (conn) => {
      appendLog(`Call connected (${conn.parameters?.call_sid || 'no SID'})`)
      setStatus('on-call')
      setConnection(conn)
    })
    dev.on('disconnect', () => {
      appendLog('Call disconnected')
      setStatus('ready')
      setConnection(null)
    })
  }, [appendLog])

  const ensureDevice = useCallback(async () => {
    if (device) {
      return device
    }
    setLoading(true)
    setError('')
    setStatus('initializing')

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const apiError = payload?.error
        throw new Error(apiError || `Token request failed (${response.status})`)
      }

      const { token } = await response.json()

      const createDevice = async () => {
        const options = {
          codecPreferences: ['opus', 'pcmu'],
          logLevel: 'error',
        }

        if (typeof Device.create === 'function') {
          return Device.create(token, options)
        }

        return new Device(token, options)
      }

      const createdDevice = await createDevice()

      registerDeviceEvents(createdDevice)
      setDevice(createdDevice)
      appendLog('Twilio Device created')

      if (
        typeof Device.create !== 'function' &&
        typeof createdDevice.register === 'function'
      ) {
        await createdDevice.register()
      }

      return createdDevice
    } catch (err) {
      const message = err?.message || 'Unexpected error'
      setError(message)
      setStatus('error')
      appendLog(`Failed to initialize device: ${message}`)
      throw err
    } finally {
      setLoading(false)
    }
  }, [appendLog, device, identity, registerDeviceEvents])

  const handleCall = useCallback(async () => {
    if (!number) {
      setError('Enter a number to dial (E.164, e.g. +14155552671)')
      return
    }
    setError('')

    try {
      const dev = await ensureDevice()
      setStatus('connecting')
      const outgoing = await dev.connect({
        params: {
          To: number,
          identity,
        },
      })
      setConnection(outgoing)
      appendLog(`Dialing ${number}`)
    } catch (err) {
      const message = err?.message || 'Failed to start call'
      setError(message)
      setStatus('error')
      appendLog(`Call failed: ${message}`)
    }
  }, [appendLog, ensureDevice, identity, number])

  const handleHangup = useCallback(() => {
    if (connection) {
      connection.disconnect()
      appendLog('Call disconnected manually')
    }
    if (device) {
      device.disconnectAll()
    }
  }, [appendLog, connection, device])

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'idle':
        return 'Idle'
      case 'initializing':
        return 'Initializing device…'
      case 'ready':
        return 'Ready to call'
      case 'connecting':
        return 'Connecting…'
      case 'on-call':
        return 'On call'
      case 'incoming':
        return 'Incoming call'
      case 'error':
        return 'Error'
      default:
        return status
    }
  }, [status])

  return (
    <div className="app">
      <header>
        <h1>ClickUp Dialer</h1>
        <p>Place ClickUp calls through Twilio from your browser.</p>
      </header>

      <section className="panel">
        <div className="field">
          <label htmlFor="identity">Agent identity</label>
          <input
            id="identity"
            type="text"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            placeholder="clickup-agent"
          />
        </div>

        <div className="field">
          <label htmlFor="number">Phone number</label>
          <input
            id="number"
            type="tel"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="+14155552671"
          />
        </div>

        <div className="actions">
          <button
            type="button"
            className="call"
            onClick={handleCall}
            disabled={loading || status === 'connecting' || status === 'on-call'}
          >
            {status === 'on-call' ? 'On Call' : 'Call'}
          </button>
          <button
            type="button"
            className="hangup"
            onClick={handleHangup}
            disabled={!connection}
          >
            Hang Up
          </button>
        </div>

        <div className="status">
          <span className={`badge ${status}`}>
            Status: {statusLabel}
          </span>
          {loading && <span className="hint">Fetching token…</span>}
        </div>

        {error && <div className="error">{error}</div>}
      </section>

      <section className="panel log">
        <h2>Recent activity</h2>
        {logs.length === 0 ? (
          <p className="empty">No calls yet.</p>
        ) : (
          <ul>
            {logs.map((entry, index) => (
              <li key={`${entry.timestamp}-${index}`}>
                <span className="timestamp">[{entry.timestamp}]</span> {entry.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel help">
        <h2>ClickUp link format</h2>
        <code>https://your-dialer.domain/?number=%2B14155551212</code>
        <p>
          Configure a ClickUp Phone field automation to open the dialer URL with the
          phone number encoded as the <code>number</code> query parameter.
        </p>
      </section>
    </div>
  )
}

export default App
