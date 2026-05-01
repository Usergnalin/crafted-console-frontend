import { create } from 'zustand'

const useTeamStore = create((set, get) => ({
  teams: {},
  status: {},
  selectedTeam: null,

  // Initialize team state
  initializeTeam: (teamId) => {
    const { teams, status } = get()
    if (teams[teamId]) return
    
    set({
      teams: {
        ...teams,
        [teamId]: {
          agents: {},
          servers: {},
          modules: {},
          commands: {}
        }
      },
      status: {
        ...status,
        [teamId]: 'idle'
      }
    })
  },

  // Replace entire team state (used for reconciliation)
  replaceTeamState: (teamId, newState) => {
    set((state) => ({
      teams: {
        ...state.teams,
        [teamId]: newState
      }
    }))
  },

  // Apply single event to team state
  applyEvent: (teamId, event) => {
    const { teams } = get()
    const team = teams[teamId]
    if (!team) return

    const type = event._action
    const resource = event._resource
    const { _action, _resource, ...data } = event

    const resourceKey = getResourceKey(resource)
    
    if (!resourceKey || !team[resourceKey]) return

    set((state) => {
      const newTeam = { ...state.teams[teamId] }
      const resourceMap = { ...newTeam[resourceKey] }

      // Get the correct ID field name for this resource type
      const idField = getIdField(resource)
      const resourceId = data[idField]

      if (type === 'delete') {
        delete resourceMap[resourceId]
      } else {
        // Only update if revision is newer or doesn't exist
        const existing = resourceMap[resourceId]
        if (!existing || data.revision > existing.revision) {
          resourceMap[resourceId] = data
        }
      }

      newTeam[resourceKey] = resourceMap
      return {
        teams: {
          ...state.teams,
          [teamId]: newTeam
        }
      }
    })
  },

  // Update team connection status
  updateStatus: (teamId, newStatus) => {
    set((state) => ({
      status: {
        ...state.status,
        [teamId]: newStatus
      }
    }))
  },

  // Clean up team data
  cleanupTeam: (teamId) => {
    set((state) => {
      const teams = { ...state.teams }
      const status = { ...state.status }
      delete teams[teamId]
      delete status[teamId]
      return { teams, status }
    })
  },

  // Select active team
  selectTeam: (teamId) => {
    set({ selectedTeam: teamId })
  }
}))

// Helper function to map resource types to state keys
const getResourceKey = (resource) => {
  const mapping = {
    agent: 'agents',
    server: 'servers', 
    module: 'modules',
    command: 'commands'
  }
  return mapping[resource]
}

// Helper function to map resource types to their ID field names
const getIdField = (resource) => {
  const mapping = {
    agent: 'agent_id',
    server: 'server_id',
    module: 'module_id',
    command: 'command_id'
  }
  return mapping[resource]
}

export default useTeamStore
