import { useEffect, useRef, useCallback } from 'react'
import { useApi } from '../api/client.jsx'
import useTeamStore from '../stores/teamStore.jsx'
import TeamReconciler from '../services/teamReconciler.js'

// Global reconciler instance
const reconciler = new TeamReconciler(useTeamStore)

// Global refs to track connection state across all hook instances
const connectedTeamRef = { current: null }
const globalSseRef = { current: null }
const globalReconnectTimeoutRef = { current: null }

export function useTeamConnection(teamId) {
  const { create_sse, auth_client, perform_refresh } = useApi()
  const isFirstLoadRef = useRef(true)
  const myTeamRef = useRef(teamId)

  // Define fetchSnapshotAndReconcile first (before startConnection)
  const fetchSnapshotAndReconcile = useCallback(async () => {
    // Check if still the active team connection (avoids stale destroyedRef closure)
    if (connectedTeamRef.current !== teamId || !teamId) return

    const store = useTeamStore.getState()

    try {
      // Fetch snapshot
      const response = await auth_client.get(`/team/${teamId}`)

      // Check if still the active team connection before applying
      if (connectedTeamRef.current !== teamId) return

      // Reconcile buffered events with snapshot
      const reconciledState = reconciler.reconcile(teamId, response.data)

      // Replace team state atomically
      store.replaceTeamState(teamId, reconciledState)
      store.updateStatus(teamId, 'live')

      // Mark first load as complete
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false
      }

    } catch (error) {
      console.error('Failed to fetch snapshot:', error)
      store.updateStatus(teamId, 'error')

      // Retry after delay
      setTimeout(() => {
        if (connectedTeamRef.current === teamId) {
          fetchSnapshotAndReconcile()
        }
      }, 2000)
    }
  }, [teamId, auth_client])

  const startConnection = useCallback(async () => {
    if (connectedTeamRef.current !== teamId || !teamId) return

    const store = useTeamStore.getState()

    // Initialize team state
    store.initializeTeam(teamId)

    // Only show loading status on first load, not during refresh cycles
    if (isFirstLoadRef.current) {
      store.updateStatus(teamId, 'connecting')
    } else {
      // During refresh, keep existing status (usually 'live') so UI doesn't show loading
      store.updateStatus(teamId, 'reconnecting')
    }

    try {
      // 1. Start SSE connection first - events will be buffered
      globalSseRef.current = create_sse(`/team/${teamId}/stream`, {
        onOpen: () => {
          // Check if still the active team connection (avoids stale destroyedRef closure)
          if (connectedTeamRef.current !== teamId) return

          // Show reconciling status on first load, but keep it subtle during refresh
          if (isFirstLoadRef.current) {
            store.updateStatus(teamId, 'reconciling')
          }
          // During refresh, don't change status - keep it as 'reconnecting' or 'live'

          // 2. Fetch snapshot once SSE is connected and buffering
          fetchSnapshotAndReconcile()
        },

        onError: async (probeStatus) => {
          // Check if still the active team connection
          if (connectedTeamRef.current !== teamId) return
          store.updateStatus(teamId, 'reconnecting')

          if (probeStatus === 401) {
            // Session expired - try to refresh token
            try {
              await perform_refresh()
              // After refresh, start new connection cycle
              setTimeout(startConnection, 1000)
            } catch (error) {
              // Refresh failed - let auth interceptor handle navigation
              console.error('Token refresh failed:', error)
            }
          } else {
            // Other error - retry after delay
            if (globalReconnectTimeoutRef.current) {
              clearTimeout(globalReconnectTimeoutRef.current)
            }
            globalReconnectTimeoutRef.current = setTimeout(startConnection, 2000)
          }
        },

        onSessionExpiry: () => {
          // Check if still the active team connection
          if (connectedTeamRef.current !== teamId) return

          globalSseRef.current?.close()
          store.updateStatus(teamId, 'reconnecting')

          // Refresh token and restart cycle
          perform_refresh()
            .then(() => {
              setTimeout(startConnection, 1000)
            })
            .catch(error => {
              console.error('Token refresh failed:', error)
            })
        },

        events: {
          'message': (event) => {
            // Check if still the active team connection
            if (connectedTeamRef.current !== teamId) return

            // Buffer regular events
            reconciler.bufferEvent(teamId, event)

            // Get fresh state and apply immediately if live
            const freshStore = useTeamStore.getState()
            if (freshStore.status[teamId] === 'live') {
              freshStore.applyEvent(teamId, event)
            }
          }
        }
      })
    } catch (error) {
      console.error('Failed to create SSE connection:', error)
      store.updateStatus(teamId, 'error')
    }
  }, [teamId, create_sse, auth_client, perform_refresh, fetchSnapshotAndReconcile])

  // Start connection when teamId changes
  useEffect(() => {
    if (!teamId) return

    // If already connected to this team, don't reconnect (prevents reconnection on tab/server switch)
    // The event stream has been continuous - no snapshot needed
    if (connectedTeamRef.current === teamId && globalSseRef.current) {
      return
    }

    // Close any existing connection from a different team
    if (connectedTeamRef.current && connectedTeamRef.current !== teamId) {
      globalSseRef.current?.close()
      globalSseRef.current = null
      reconciler.cleanupTeam(connectedTeamRef.current)
    }

    myTeamRef.current = teamId
    connectedTeamRef.current = teamId
    startConnection()

    return () => {
      // Only clean up if we're actually switching to a different team
      // (not just remounting within the same team)
      if (connectedTeamRef.current !== myTeamRef.current) {
        // Clean up connection
        globalSseRef.current?.close()
        globalSseRef.current = null
        
        // Clean up timeouts
        if (globalReconnectTimeoutRef.current) {
          clearTimeout(globalReconnectTimeoutRef.current)
          globalReconnectTimeoutRef.current = null
        }
        
        // Clean up reconciler buffers for old team
        reconciler.cleanupTeam(myTeamRef.current)
      }
    }
  }, [teamId, startConnection])
}
