import { useCallback } from 'react'
import useTeamStore from '../stores/teamStore.jsx'

// Hook for accessing team data with the simple API you requested
export function useTeamData(teamId) {
  const teams = useTeamStore(state => state.teams)
  const initializeTeam = useTeamStore(state => state.initializeTeam)
  
  // Ensure team is initialized
  if (teamId && !teams[teamId]) {
    initializeTeam(teamId)
  }

  // Return the team data or empty object if not available
  return teams[teamId] || {
    agents: {},
    servers: {},
    modules: {},
    commands: {}
  }
}

// Hook for accessing specific resource types (for optimization)
export function useAgents(teamId) {
  return useTeamStore(state => state.teams[teamId]?.agents || {})
}

export function useServers(teamId) {
  return useTeamStore(state => state.teams[teamId]?.servers || {})
}

export function useModules(teamId) {
  return useTeamStore(state => state.teams[teamId]?.modules || {})
}

export function useCommands(teamId) {
  return useTeamStore(state => state.teams[teamId]?.commands || {})
}

// Hook for accessing a single resource by ID
export function useAgent(teamId, agentId) {
  return useTeamStore(state => state.teams[teamId]?.agents[agentId])
}

export function useServer(teamId, serverId) {
  return useTeamStore(state => state.teams[teamId]?.servers[serverId])
}

export function useModule(teamId, moduleId) {
  return useTeamStore(state => state.teams[teamId]?.modules[moduleId])
}

export function useCommand(teamId, commandId) {
  return useTeamStore(state => state.teams[teamId]?.commands[commandId])
}

// Hook for team selection
export function useSelectedTeam() {
  const selectedTeam = useTeamStore(state => state.selectedTeam)
  const selectTeam = useTeamStore(state => state.selectTeam)
  
  return {
    selectedTeam,
    selectTeam
  }
}
