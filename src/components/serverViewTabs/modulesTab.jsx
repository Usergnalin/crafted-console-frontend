import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Power, Package, FileCode, Layers } from 'lucide-react'
import { useTeamData } from '../../hooks/useTeamData.jsx'
import { useApi } from '../../api/client.jsx'
import ModuleView from '../moduleView.jsx'

export default function ModulesTab({ agentId, serverId, teamId, onBrowseModules }) {
    const [selectedType, setSelectedType] = useState('all')
    const [selectedModule, setSelectedModule] = useState(null)
    const [togglingModules, setTogglingModules] = useState(new Set())
    const [deletingModules, setDeletingModules] = useState(new Set())
    const teamData = useTeamData(teamId)
    const { auth_client } = useApi()

    // Track previous module states to detect changes
    const prevModulesRef = useRef({})

    // Get server properties to determine loader type
    const server = teamData?.servers?.[serverId]
    const serverLoaderType = server?.properties?.loader_type

    // Determine available module types based on server loader type
    const getAvailableModuleTypes = () => {
        const baseTypes = [
            { id: 'all', label: 'All', icon: Layers }
        ]

        if (["fabric", "forge", "quilt", "neoforge"].includes(serverLoaderType)) {
            return [
                ...baseTypes,
                { id: 'mod', label: 'Mods', icon: Package },
                { id: 'resourcepack', label: 'Resource Packs', icon: Package },
                { id: 'datapack', label: 'Data Packs', icon: FileCode }
            ]
        } else if (["bukkit", "paper"].includes(serverLoaderType)) {
            return [
                ...baseTypes,
                { id: 'plugin', label: 'Plugins', icon: FileCode },
                { id: 'resourcepack', label: 'Resource Packs', icon: Package },
                { id: 'datapack', label: 'Data Packs', icon: FileCode }
            ]
        } else if (["vanilla"].includes(serverLoaderType)) {
            return [
                ...baseTypes,
                { id: 'resourcepack', label: 'Resource Packs', icon: Package },
                { id: 'datapack', label: 'Data Packs', icon: FileCode }
            ]
        }

        // Default fallback - show all types
        return [
            ...baseTypes,
            { id: 'mod', label: 'Mods', icon: Package },
            { id: 'plugin', label: 'Plugins', icon: FileCode },
            { id: 'resourcepack', label: 'Resource Packs', icon: Package },
            { id: 'datapack', label: 'Data Packs', icon: FileCode }
        ]
    }

    const availableModuleTypes = getAvailableModuleTypes()

    // Set default selected type if current selection is not available
    useEffect(() => {
        if (!availableModuleTypes.find(type => type.id === selectedType)) {
            setSelectedType(availableModuleTypes[0]?.id || 'all')
        }
    }, [serverLoaderType, selectedType, availableModuleTypes])

    // Modules are stored flat in teamData, filter by server_id
    const modules = Object.values(teamData?.modules || {}).filter(m => m.server_id === serverId)

    // Build current modules map for comparison
    const currentModulesMap = {}
    modules.forEach(m => {
        currentModulesMap[m.module_id] = m
    })

    // Check for state changes and stop spinners early
    useEffect(() => {
        // Check toggling modules - stop if state changed
        setTogglingModules(prev => {
            const next = new Set(prev)
            for (const moduleId of next) {
                const prevModule = prevModulesRef.current[moduleId]
                const currentModule = currentModulesMap[moduleId]
                // If module exists and enabled state changed, stop spinner
                if (prevModule && currentModule && prevModule.module_enabled !== currentModule.module_enabled) {
                    next.delete(moduleId)
                }
            }
            return next
        })

        // Check deleting modules - stop if module is gone
        setDeletingModules(prev => {
            const next = new Set(prev)
            for (const moduleId of next) {
                if (!currentModulesMap[moduleId]) {
                    next.delete(moduleId)
                }
            }
            return next
        })

        // Update ref for next comparison
        prevModulesRef.current = currentModulesMap
    }, [modules])

    const filteredModules = selectedType === 'all'
        ? modules
        : modules.filter(m => m.module_type === selectedType)

    const handleToggleModule = (moduleId, currentEnabled) => {
        // Start spinner immediately
        setTogglingModules(prev => new Set(prev).add(moduleId))

        // Send command
        auth_client.post(`/command/${agentId}`, {
            command: {
                type: currentEnabled ? 'disable_module' : 'enable_module',
                server_id: serverId,
                module_id: moduleId
            }
        })

        // Max 2 second timeout - spinner stops earlier if state changes (via useEffect)
        setTimeout(() => {
            setTogglingModules(prev => {
                const next = new Set(prev)
                next.delete(moduleId)
                return next
            })
        }, 2000)
    }

    const handleDeleteModule = (moduleId) => {
        // Start spinner immediately
        setDeletingModules(prev => new Set(prev).add(moduleId))

        // Send command
        auth_client.post(`/command/${agentId}`, {
            command: {
                type: 'delete_module',
                server_id: serverId,
                module_id: moduleId
            }
        })

        // Max 2 second timeout - spinner stops earlier if module deleted (via useEffect)
        setTimeout(() => {
            setDeletingModules(prev => {
                const next = new Set(prev)
                next.delete(moduleId)
                return next
            })
        }, 2000)
    }

    return (
        <div className="flex gap-4 h-[calc(90vh-120px)]">
            {/* Left Sidebar - Type Filters */}
            <div className="w-48 bg-bg-card rounded-lg p-3 flex flex-col gap-2">
                {availableModuleTypes.map(type => {
                    const Icon = type.icon
                    const count = type.id === 'all'
                        ? modules.length
                        : modules.filter(m => m.module_type === type.id).length

                    return (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                                selectedType === type.id
                                    ? 'bg-bg-secondary text-text-primary hover:bg-bg-secondary'
                                    : 'text-text-muted hover:bg-bg-surface'
                            }`}
                        >
                            <Icon size={16} />
                            <span className="flex-1">{type.label}</span>
                            <span className="text-xs bg-bg-secondary px-2 py-0.5 rounded">
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Right - Module List */}
            <div className="flex-1 bg-bg-card rounded-lg p-4 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-text-primary">
                        {availableModuleTypes.find(t => t.id === selectedType)?.label} ({filteredModules.length})
                    </h3>
                    <button
                        onClick={() => onBrowseModules(agentId, serverId)}
                        className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-primary transition-colors"
                    >
                        <Plus size={18} />
                        Add Modules
                    </button>
                </div>

                {/* Module List */}
                <div className="flex-1 overflow-y-auto space-y-2">
                    {filteredModules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-text-muted">
                            <Package size={48} className="mb-4 opacity-50" />
                            <p>No modules found</p>
                            <p className="text-sm">Click "Add Modules" to install</p>
                        </div>
                    ) : (
                        filteredModules.map(module => (
                            <div
                                key={module.module_id}
                                className="flex items-center gap-3 p-3 bg-bg-surface rounded-lg hover:bg-bg-card-hover transition-colors cursor-pointer group"
                                onClick={() => setSelectedModule(module)}
                            >
                                {/* Module Icon */}
                                {module.module_metadata?.icon_url ? (
                                    <img
                                        src={module.module_metadata.icon_url}
                                        alt={module.module_name}
                                        className={`w-10 h-10 rounded object-cover ${!module.module_enabled ? 'opacity-40 grayscale' : ''}`}
                                    />
                                ) : (
                                    <div className={`w-10 h-10 bg-bg-card rounded flex items-center justify-center ${!module.module_enabled ? 'opacity-40' : ''}`}>
                                        <Package size={20} className="text-text-muted" />
                                    </div>
                                )}

                                {/* Module Info */}
                                <div className={`flex-1 min-w-0 ${!module.module_enabled ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-text-primary truncate">
                                            {module.module_name}
                                        </h4>
                                        <span className="text-xs px-2 py-0.5 bg-bg-card rounded text-text-muted capitalize">
                                            {module.module_type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-muted truncate">
                                        {module.module_metadata?.file_name || 'No file info'}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {/* Enable/Disable Toggle */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (!togglingModules.has(module.module_id)) {
                                                handleToggleModule(module.module_id, module.module_enabled)
                                            }
                                        }}
                                        disabled={togglingModules.has(module.module_id)}
                                        className={`p-2 rounded transition-colors ${
                                            togglingModules.has(module.module_id)
                                                ? 'bg-bg-surface cursor-not-allowed'
                                                : module.module_enabled
                                                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                                                    : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/40'
                                        }`}
                                        title={module.module_enabled ? 'Disable' : 'Enable'}
                                    >
                                        {togglingModules.has(module.module_id) ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Power size={16} />
                                        )}
                                    </button>

                                    {/* Delete */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (!deletingModules.has(module.module_id)) {
                                                handleDeleteModule(module.module_id)
                                            }
                                        }}
                                        disabled={deletingModules.has(module.module_id)}
                                        className={`p-2 rounded transition-colors ${
                                            deletingModules.has(module.module_id)
                                                ? 'bg-bg-surface cursor-not-allowed'
                                                : 'bg-red-600/20 text-red-400 hover:bg-red-600/40'
                                        }`}
                                        title="Delete"
                                    >
                                        {deletingModules.has(module.module_id) ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Module View Modal */}
            {selectedModule && (
                <ModuleView
                    teamId={teamId}
                    agentId={agentId}
                    serverId={serverId}
                    projectId={selectedModule.module_metadata?.project_id}
                    onClose={() => setSelectedModule(null)}
                    isInstalled={true}
                />
            )}
        </div>
    )
}
