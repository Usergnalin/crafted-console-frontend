// hooks/useTeamSSE.js
import { useEffect, useRef, useCallback } from "react"
import { useApi } from "../api/client.jsx"
import useTeamStore from "../stores/teamStore.jsx"

export function useTeamSSE(teamId) {
  const { create_sse, auth_client, perform_refresh } = useApi()
  const destroyedRef = useRef(false)
  const sseRef = useRef(null)

  const connect = useCallback(() => {
    if (destroyedRef.current) return

    const store = useTeamStore.getState()

    // Reset snapshot gate — new events will buffer
    store._ensureTeam(teamId)
    useTeamStore.setState(state => ({
      snapshotReady: { ...state.snapshotReady, [teamId]: false },
      eventBuffers:  { ...state.eventBuffers,  [teamId]: [] },
      status:        { ...state.status,        [teamId]: 'connecting' },
    }))

    // 1. Open SSE first — events buffer via bufferOrApply
    sseRef.current = create_sse(`/team/${teamId}/stream`, {
      onOpen: () => {
        if (destroyedRef.current) return
        useTeamStore.setState(state => ({
          status: { ...state.status, [teamId]: 'syncing' }  // SSE up, snapshot pending
        }))

        // 2. Now fetch snapshot — SSE is already buffering
        auth_client.get(`/team/${teamId}`)
          .then(res => {
            if (destroyedRef.current) return
            // 3. Apply snapshot + drain buffer
            useTeamStore.getState().applySnapshot(teamId, res.data)
            useTeamStore.setState(state => ({
              status: { ...state.status, [teamId]: 'live' }
            }))
          })
          .catch(err => {
            // Snapshot fetch failed — tear down and retry whole cycle
            if (destroyedRef.current) return
            console.error("Snapshot fetch failed", err)
            sseRef.current?.close()
            setTimeout(connect, 2000)
          })
      },

      onError: async (probeStatus) => {
        if (destroyedRef.current) return
        useTeamStore.setState(state => ({
          status: { ...state.status, [teamId]: 'reconnecting' }
        }))

        if (probeStatus === 401) {
          try {
            await perform_refresh()  // or perform_refresh()
          } catch {
            return  // on_refresh_fail() navigates away, we're done
          }
        }

        setTimeout(connect, 2000)
      }
    })
  }, [teamId, auth_client, create_sse])

  useEffect(() => {
    if (!teamId) return
    destroyedRef.current = false
    connect()

    return () => {
      destroyedRef.current = true
      sseRef.current?.close()
      useTeamStore.getState().teardownTeam(teamId)
    }
  }, [teamId, connect])
}