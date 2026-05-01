import useTeamStore from '../stores/teamStore.jsx'

// Hook for accessing team connection status
export function useTeamStatus(teamId) {
  return useTeamStore(state => state.status[teamId] || 'idle')
}

// Hook for checking if team is live and ready
export function useTeamIsLive(teamId) {
  const status = useTeamStore(state => state.status[teamId] || 'idle')
  return status === 'live'
}

// Hook for checking if team is loading (only shows loading on first load, not refresh cycles)
export function useTeamIsLoading(teamId) {
  const status = useTeamStore(state => state.status[teamId] || 'idle')
  return ['connecting', 'reconciling'].includes(status) && status !== 'reconnecting'
}

// Hook for checking if team has errors
export function useTeamHasError(teamId) {
  const status = useTeamStore(state => state.status[teamId] || 'idle')
  return status === 'error'
}
