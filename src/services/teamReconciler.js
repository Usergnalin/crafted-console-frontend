class TeamReconciler {
  constructor(store) {
    this.store = store
    this.eventBuffers = new Map() // teamId -> events[]
    this.maxBufferSize = 1000 // Prevent memory leaks
  }

  // Add event to buffer for a team
  bufferEvent(teamId, event) {
    if (!this.eventBuffers.has(teamId)) {
      this.eventBuffers.set(teamId, [])
    }

    const buffer = this.eventBuffers.get(teamId)
    buffer.push(event)

    // Prevent memory leaks - remove oldest events if buffer gets too large
    if (buffer.length > this.maxBufferSize) {
      buffer.splice(0, buffer.length - this.maxBufferSize)
    }
  }

  // Get and clear buffered events
  getBufferedEvents(teamId) {
    const events = this.eventBuffers.get(teamId) || []
    this.eventBuffers.set(teamId, [])
    return events
  }

  // Convert snapshot rows to object maps
  snapshotToState(snapshot) {
    return {
      agents: this.toMap(snapshot.agents, 'agent_id'),
      servers: this.toMap(snapshot.servers, 'server_id'),
      modules: this.toMap(snapshot.modules, 'module_id'),
      commands: this.toMap(snapshot.commands, 'command_id')
    }
  }

  // Reconcile buffered events with snapshot
  reconcile(teamId, snapshot) {
    const baseState = this.snapshotToState(snapshot)
    const bufferedEvents = this.getBufferedEvents(teamId)

    // Apply buffered events in chronological order
    let reconciledState = baseState
    bufferedEvents.forEach(event => {
      reconciledState = this.applyEventToState(reconciledState, event)
    })

    return reconciledState
  }

  // Apply single event to state object
  applyEventToState(state, event) {
    const type = event._action
    const resource = event._resource
    const { _action, _resource, ...data } = event
    const resourceKey = this.getResourceKey(resource)
    
    if (!resourceKey || !state[resourceKey]) {
      return state
    }

    const newState = { ...state }
    const resourceMap = { ...newState[resourceKey] }

    // Get the correct ID field name for this resource type
    const idField = this.getIdField(resource)
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

    newState[resourceKey] = resourceMap
    return newState
  }

  // Convert array to object map
  toMap(rows = [], key) {
    return Object.fromEntries(rows.map(r => [r[key], r]))
  }

  // Map resource type to state key
  getResourceKey(resource) {
    const mapping = {
      agent: 'agents',
      server: 'servers',
      module: 'modules',
      command: 'commands'
    }
    return mapping[resource]
  }

  // Map resource type to ID field name
  getIdField(resource) {
    const mapping = {
      agent: 'agent_id',
      server: 'server_id',
      module: 'module_id',
      command: 'command_id'
    }
    return mapping[resource]
  }

  // Clear buffer for a team
  clearBuffer(teamId) {
    this.eventBuffers.delete(teamId)
  }

  // Clean up all data for a team
  cleanupTeam(teamId) {
    this.clearBuffer(teamId)
  }
}

export default TeamReconciler
