import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * WebSocket hook with auto-reconnect.
 *
 * Auto-detects ws:// vs wss:// from window.location.
 * Reconnects with exponential backoff on disconnect.
 */
export function useWebSocket(path, { onMessage, queryParams = {} } = {}) {
  const [readyState, setReadyState] = useState(WebSocket.CLOSED)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const reconnectDelay = useRef(1000)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const getUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    let url = `${protocol}//${host}${path}`
    const params = new URLSearchParams(queryParams)
    const qs = params.toString()
    if (qs) url += `?${qs}`
    return url
  }, [path, JSON.stringify(queryParams)])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = getUrl()
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN)
      reconnectDelay.current = 1000 // reset backoff
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED)
      // Auto-reconnect with exponential backoff
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 10000)
        connect()
      }, reconnectDelay.current)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [getUrl])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return {
    sendMessage,
    readyState,
    isConnected: readyState === WebSocket.OPEN,
  }
}
