import {useTeamConnection} from '../hooks/useTeamConnection.jsx'
import {useTeamStatus, useTeamIsLoading} from '../hooks/useTeamStatus.jsx'
import { Copy, Package, Settings, MoreVertical, Trash2 } from "lucide-react"
import {useTeamData} from '../hooks/useTeamData.jsx'
import {useApi} from '../api/client.jsx'
import {useState, useEffect} from 'react'

export default function TeamView({ teamData, onSelectServer, onInstallModpack }) {
    useTeamConnection(teamData.team_id)
    const team_data = useTeamData(teamData.team_id)
    const status = useTeamStatus(teamData.team_id)
    const isLoading = useTeamIsLoading(teamData.team_id)
    const [loadingServersAction, setLoadingServersAction] = useState({})
    const [showLinkingModal, setShowLinkingModal] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(null) // agentId or null
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [agentToDelete, setAgentToDelete] = useState(null)
    const [deletingAgent, setDeletingAgent] = useState(false)

    const [ServerCreateModalState, setServerCreateModalState] = useState(false)
    const [serverCreateAgentId, setServerCreateAgentId] = useState(null)
    const [mcVersions, setMcVersions] = useState([])
    const [selectedMcVersion, setSelectedMcVersion] = useState("")
    const [availableLoaders, setAvailableLoaders] = useState([])
    const [selectedLoaderVersions, setSelectedLoaderVersions] = useState({})
    const [selectedLoaderType, setSelectedLoaderType] = useState(null)
    const [serverName, setServerName] = useState("")
    const [serverThumbnailUrl, setServerThumbnailUrl] = useState("")

    const [linkingCode, setLinkingCode] = useState("")
    const {auth_client, client} = useApi()

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownOpen && !event.target.closest('.dropdown-menu')) {
                setDropdownOpen(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [dropdownOpen])

    const loader_config = [
        { id: 'vanilla', label: 'Vanilla', icon: <Package size={40} className="mt-10 text-gray-400" />, noVersions: true },
        { id: 'fabric', label: 'Fabric', icon: <Package size={40} className="mb-3 text-blue-400" /> },
        { id: 'forge', label: 'Forge', icon: <Settings size={40} className="mb-3 text-emerald-400" /> },
        { id: 'neoforge', label: 'NeoForge', icon: <Settings size={40} className="mb-3 text-orange-400" /> },
        { id: 'quilt', label: 'Quilt', icon: <Package size={40} className="mb-3 text-purple-400" /> },
    ]

    if (isLoading || status === 'idle') {
        return <p className="text-text-muted">Loading team...</p>
    }

    if (status === 'connecting' || status === 'reconciling') {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-purple-300 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                <p className="text-text-muted">
                    {status === 'connecting' ? 'Connecting to team...' : 'Reconciling team data...'}
                </p>
            </div>
        )
    }

    if (status === 'reconnecting') {
        return (
            <div className="flex flex-col items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-yellow-300 border-t-yellow-500 rounded-full animate-spin mb-3"></div>
                <p className="text-yellow-500 text-sm">Reconnecting...</p>
            </div>
        )
    }

    if (status === 'error') {
        return <p className="text-red-500">Error loading team data</p>
    }

    const copyTeamIdentifier = () => {
        const identifier = `${teamData?.team_name}@${teamData?.slug}`
        navigator.clipboard.writeText(identifier)
    }

    const copyLinkingCode = () => {
        navigator.clipboard.writeText(linkingCode)
    }

    const getThumbnailColor = (identifier) => {
        const colors = [
            "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
            "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-indigo-500",
            "bg-violet-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
        ]

        let hash = 0
        for (let i = 0; i < identifier.length; i++) {
            hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
        }
        
        const index = Math.abs(hash) % colors.length
        return colors[index]
    }

    const getInitials = (name) => {
        if (!name) return ""
        const words = name.trim().split(/\s+/)
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase()
        } else {
            return name.slice(0, 2).toUpperCase()
        }
    }

    const getAgentStatusColor = (status) => {
        switch (status) {
            case 'online': return 'bg-status-online'
            case 'offline': return 'bg-status-offline'
            default: return 'bg-status-offline'
        }
    }
    const getServerStatusColor = (status) => {
        switch (status) {
            case 'online': return 'bg-status-online'
            case 'offline': return 'bg-status-offline'
            case 'starting': return 'bg-status-starting'
            case 'stopping': return 'bg-status-stopping'
            default: return 'bg-status-offline'
        }
    }

    const getServersForAgent = (agentId) => {
        return Object.values(team_data.servers).filter(server => server.agent_id === agentId)
    }

    const handleServerAction = (agentId, serverId, action) => {
        setLoadingServersAction(previous => ({ ...previous, [serverId]: true }))
        auth_client.post(`/command/${agentId}`, {
            "command": {
                "type": action,
                "server_id": serverId
            }
        }).then(() => {
            setTimeout(() => {
                setLoadingServersAction(previous => ({ ...previous, [serverId]: false }))
            }, 2000)
        })
    }

    const handleLinkingCode = () => {
        auth_client.post(`/agent/${teamData.team_id}/link`)
        .then(response => {
            setLinkingCode(response.data)
            setShowLinkingModal(true)
        })
    }

    const handleDeleteAgent = (agentId, agentName) => {
        setAgentToDelete({ id: agentId, name: agentName })
        setShowDeleteModal(true)
        setDropdownOpen(null)
    }

    const confirmDeleteAgent = () => {
        if (!agentToDelete) return
        
        setDeletingAgent(true)
        auth_client.delete(`/agent/${agentToDelete.id}`)
        .then(() => {
            setShowDeleteModal(false)
            setAgentToDelete(null)
        })
        .catch(error => {
            console.error('Failed to delete agent:', error)
        })
        .finally(() => {
            setDeletingAgent(false)
        })
    }

    const handleCreateCustomServer = () => {
        client.get('/version')
        .then(response => {
            setMcVersions(response.data)
            setServerCreateModalState('select_version')
            setSelectedMcVersion(response.data[0])
            setAvailableLoaders({})
            setSelectedLoaderVersions({})
            setSelectedLoaderType(null)
            handleSelectedMcVersionChange(response.data[0])
            setSelectedLoaderVersions()
            availableLoaders[`${loader.id}_main`]

        })
    }

    const handleSelectedMcVersionChange = (new_version) => {
        client.get(`/version/${new_version}/loaders`)
        .then(response => {
            setAvailableLoaders(response.data)
            setSelectedMcVersion(new_version)
            setSelectedLoaderType(null)
            // Auto-select main version for all available loaders
            const initialVersions = {}
            for (const [key, value] of Object.entries(response.data)) {
                if (key.endsWith('_main')) {
                    const loaderId = key.replace('_main', '')
                    initialVersions[loaderId] = value
                }
            }
            setSelectedLoaderVersions(initialVersions)
        })

    }

    const handleCreateServer = (agentId) => {
        setServerCreateModalState('select_install_type')
        setServerCreateAgentId(agentId)
    }

    const handleServerCreateFinal = () => {
        let command
        const thumbnailField = serverThumbnailUrl.trim() || undefined
        if (['fabric', 'quilt', 'forge', 'neoforge'].includes(selectedLoaderType)) {
            command = {
                type: "create_server",
                name: serverName,
                mc_version: selectedMcVersion,
                loader_version: selectedLoaderVersions[selectedLoaderType],
                loader_type: selectedLoaderType,
                server_thumbnail: thumbnailField
            }
        } else if (selectedLoaderType === 'vanilla') {
            command = {
                type: "create_server",
                name: serverName,
                mc_version: selectedMcVersion,
                loader_type: selectedLoaderType,
                server_thumbnail: thumbnailField
            }
        }
        auth_client.post(`/command/${serverCreateAgentId}`, {command})
        .then(response => {
            setServerCreateModalState(false)
            setServerThumbnailUrl("")
        })
    }

    const handleLoaderVersionChange = (loaderId, new_version) => {
        setSelectedLoaderVersions(previous => ({ ...previous, [loaderId]: new_version }))
    }

    const agentIds = Object.keys(team_data.agents)

    return (
        <div className="max-h-[90vh] overflow-y-auto pr-2">
            <div className="flex items-baseline space-x-2">
                {/* Team name */}
                <h1 className="text-2xl font-bold text-text-primary">
                    {teamData?.team_name}
                </h1>

                {/* slug */}
                <span className="text-sm text-gray-500">
                    @{teamData?.slug}
                </span>

                {/* copy button */}
                <button
                    onClick={() => copyTeamIdentifier()}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                    <Copy size={16} />
                </button>
                <button
                    onClick={() => handleLinkingCode()}
                    className="ml-auto px-3 py-1.5 mr-4 text-sm font-medium bg-bg-surface text-white rounded-lg hover:bg-accent-primary transition-colors"
                >
                    Link Agent
                </button>
            </div>

            {/* Linking Code Popup */}
            {showLinkingModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50">
                    <div className="bg-bg-modal p-5 rounded-xl w-80">
                        <h2 className="text-lg font-semibold text-white mb-3">
                            Agent Linking Code
                        </h2>

                        <div className="flex items-center gap-2 bg-bg-primary p-2 rounded-lg">
                            <span className="text-gray-300 text-sm flex-1 break-all">
                                {linkingCode}
                            </span>

                            <button
                                onClick={copyLinkingCode}
                                className="text-gray-400 hover:text-white"
                            >
                                <Copy size={16} />
                            </button>
                        </div>

                        <button
                            onClick={() => setShowLinkingModal(false)}
                            className="mt-4 w-full py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Agent Confirmation Modal */}
            {showDeleteModal && agentToDelete && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="bg-bg-modal p-6 rounded-xl w-96 max-w-[90vw]">
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Trash2 className="text-red-400" size={20} />
                            Delete Agent
                        </h2>
                        
                        <div className="mb-6">
                            <p className="text-gray-300 mb-3">
                                Are you sure you want to delete the agent "<span className="text-white font-medium">{agentToDelete.name}</span>"?
                            </p>
                            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
                                <p className="text-yellow-300 text-sm">
                                    <strong>Warning:</strong> This will only delete the agent from the API. 
                                    The agent software will still be installed on the computer and needs to be manually uninstalled.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false)
                                    setAgentToDelete(null)
                                }}
                                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                disabled={deletingAgent}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteAgent}
                                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                disabled={deletingAgent}
                            >
                                {deletingAgent ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} />
                                        Delete Agent
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {agentIds.length === 0 ? (
                <p className="text-text-muted">No agents found</p>
            ) : (
                <div className="space-y-6">
                    {agentIds.map(agentId => {
                        const agent = team_data.agents[agentId]
                        const agentServers = getServersForAgent(agentId)
                        
                        return (
                            <div key={agentId} className="rounded-lg p-4">
                                {/* Agent Header */}
                                <div className="flex items-center justify-between mb-4 border-b border-border-primary pb-2">
                                    <div className="flex items-center space-x-3">
                                        {/* Status Indicator Wrapper */}
                                        <div className="relative group flex items-center justify-center">
                                            <div className={`w-3 h-3 rounded-full ${getAgentStatusColor(agent.agent_status)}`} />
                                            <div className="absolute bottom-full mb-2 hidden group-hover:block px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap capitalize z-50">
                                                {agent.agent_status}
                                            </div>
                                        </div>
                                        <h2 className="text-lg font-semibold text-text-primary">{agent.agent_name}</h2>
                                    </div>
                                    
                                    {/* Three-dot menu */}
                                    <div className="relative dropdown-menu">
                                        <button
                                            onClick={() => setDropdownOpen(dropdownOpen === agentId ? null : agentId)}
                                            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
                                        >
                                            <MoreVertical size={16} />
                                        </button>
                                        
                                        {/* Dropdown menu */}
                                        {dropdownOpen === agentId && (
                                            <div className="absolute right-0 mt-1 w-48 bg-bg-modal border border-border-primary rounded-lg shadow-lg z-50">
                                                <button
                                                    onClick={() => handleDeleteAgent(agentId, agent.agent_name)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-bg-surface hover:text-red-300 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete Agent
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Servers Grid */}
                                <div className="space-y-3">
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,300px))] gap-4 justify-start">
                                        {agentServers.map(server => (
                                            <div
                                                key={server.server_id}
                                                className="bg-bg-surface rounded-lg p-4 cursor-pointer hover:bg-bg-card-hover transition-colors"
                                                onClick={() => onSelectServer(agentId, server.server_id, server.server_name)}
                                            >
                                                <div className={`w-full aspect-square rounded mb-3 flex items-center justify-center overflow-hidden transition-colors duration-300 ${
                                                    !server.server_thumbnail ? getThumbnailColor(server.server_name) : ''
                                                }`}>
                                                    {server.server_thumbnail ? (
                                                        <img
                                                            src={server.server_thumbnail}
                                                            alt={getInitials(server.server_name)}
                                                            className="w-full h-full object-cover rounded"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none'
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                                                e.currentTarget.parentElement?.classList.add(...getThumbnailColor(server.server_name).split(' '))
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className={`text-7xl text-text-primary ${server.server_thumbnail ? 'hidden' : ''}`}>
                                                        {getInitials(server.server_name)}
                                                    </span>
                                                </div>

                                                {/* Server Header */}
                                                <div className="flex items-center justify-between mb-3">
                                                    {/* Text Stack: Name and Loader */}
                                                    <div className="flex flex-col truncate max-w-[70%]">
                                                        {/* Title on the first line */}
                                                        <h4 className="font-medium text-text-primary text-lg font-semibold truncate leading-tight">
                                                            {server.server_name}
                                                        </h4>

                                                        {/* Loader and Version on the second line */}
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-xs text-gray-400 capitalize truncate">
                                                            {server.properties.loader_type}
                                                            </span>
                                                            <span className="text-xs text-gray-400 truncate">
                                                            {server.properties.mc_version}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Status Indicator Wrapper */}
                                                    <div className="relative group flex items-center justify-center">
                                                        <div className={`w-5 h-5 shadow-lg rounded-full ${getServerStatusColor(server.server_status)}`} />
                                                        
                                                        <div className="absolute bottom-full mb-2 hidden group-hover:block px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap capitalize z-50">
                                                            {server.server_status}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Control Buttons */}
                                                <div className="flex space-x-2">
                                                    {/* Start / Stop */}
                                                    {server.server_status === 'offline' && !loadingServersAction[server.server_id] && (
                                                        <button
                                                            className="flex-1 px-3 py-1 bg-success hover:bg-success-hover text-white text-sm rounded transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleServerAction(agentId, server.server_id, 'start_server')
                                                            }}
                                                        >
                                                            Start
                                                        </button>
                                                    )}

                                                    {server.server_status === 'online' && !loadingServersAction[server.server_id] && (
                                                        <button
                                                            className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleServerAction(agentId, server.server_id, 'stop_server')
                                                            }}
                                                        >
                                                            Stop
                                                        </button>
                                                    )}

                                                    {(server.server_status === 'starting' || server.server_status === 'stopping' || loadingServersAction[server.server_id]) && (
                                                        <button
                                                            className="flex-1 px-3 py-1 bg-bg-tertiary text-sm rounded cursor-not-allowed flex items-center justify-center"
                                                            disabled
                                                        >
                                                            <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-500 rounded-full animate-spin"></div>
                                                        </button>
                                                    )}

                                                    {/* Restart */}
                                                    <button
                                                        className={`flex-1 px-3 py-1 text-white text-sm rounded transition-colors ${
                                                            server.server_status === 'online' && !loadingServersAction[server.server_id]
                                                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                                                : 'bg-gray-600 cursor-not-allowed'
                                                        }`}
                                                        disabled={server.server_status !== 'online' || loadingServersAction[server.server_id]}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleServerAction(agentId, server.server_id, 'restart_server')
                                                        }}
                                                    >
                                                        Restart
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {/* ➕ Add Server Card */}
                                        <button
                                            onClick={() => handleCreateServer(agentId)}
                                            className="bg-bg-create rounded-lg p-4 flex flex-col items-center justify-center
                                                    hover:bg-bg-create-hover transition-colors border-2 border-border-secondary border-dashed"
                                        >
                                            <div className="w-full aspect-square rounded mb-3 flex items-center justify-center">
                                                <span className="text-4xl text-text-muted">+</span>
                                            </div>
                                        </button>
                                        {ServerCreateModalState && (
                                            <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                                                <div className={`bg-bg-modal p-6 rounded-xl ${ServerCreateModalState === "select_version" ? "w-200" : ServerCreateModalState === "input_name" ? "w-200" : "w-lg"} text-white shadow-2xl`}>
                                                <h2 className="text-xl font-bold mb-4">Create Server</h2>

                                                {/* Mode Selection Cards */}
                                                {ServerCreateModalState === 'select_install_type' && (
                                                    <div>
                                                        <h2 className="text-lg font-semibold mb-4">Select Install Method</h2>
                                                        <div className="flex gap-4 mb-6">
                                                            {/* Modpack Card */}
                                                            <button
                                                                onClick={() => {
                                                                    setServerCreateModalState(false)
                                                                    setServerThumbnailUrl("")
                                                                    onInstallModpack(serverCreateAgentId)
                                                                }}
                                                                className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 bg-bg-surface border-border-secondary hover:bg-bg-primary hover:border-accent-primary"
                                                            >
                                                                <Package size={40} className="mb-3 text-blue-400" />
                                                                <span className="font-semibold">Modpack</span>
                                                            </button>

                                                            {/* Custom Card */}
                                                            <button
                                                                onClick={handleCreateCustomServer}
                                                                className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 bg-bg-surface border-border-secondary hover:bg-bg-primary hover:border-accent-primary"
                                                            >
                                                                <Settings size={40} className="mb-3 text-emerald-400" />
                                                                <span className="font-semibold">Custom</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {ServerCreateModalState === 'select_version' && (
                                                    <div>
                                                        <h2 className="text-lg font-semibold mb-4">Select Minecraft Version</h2>
                                                        <select
                                                            value={selectedMcVersion}
                                                            onChange={(e) => handleSelectedMcVersionChange(e.target.value)}
                                                            className="w-full p-3 mb-6 bg-bg-surface text-white rounded-lg focus:outline-none transition-colors"
                                                        >
                                                            {mcVersions.map((version) => (
                                                            <option key={version} value={version}>
                                                                {version}
                                                            </option>
                                                            ))}
                                                        </select>
                                                        <h2 className="text-lg font-semibold mb-4">Select Server Type</h2>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                                            {loader_config.filter((loader) => loader.noVersions || availableLoaders[`${loader.id}_main`]).map((loader) => (
                                                                <button
                                                                    key={loader.id}
                                                                    className={`flex-1 flex flex-col items-center justify-between p-6 rounded-xl border-2 transition-all duration-200 ${
                                                                    selectedLoaderType === loader.id
                                                                        ? 'border-border-primary bg-bg-primary'
                                                                        : 'border-border-secondary bg-bg-surface hover:bg-bg-card'
                                                                    }`}
                                                                    onClick={() => setSelectedLoaderType(loader.id)}
                                                                >
                                                                    {/* Card Content */}
                                                                    <div className="flex flex-col items-center mb-4">
                                                                        {loader.icon}
                                                                        <span className="font-semibold text-lg">{loader.label}</span>
                                                                    </div>

                                                                    {!loader.noVersions && (
                                                                        <select
                                                                            value={selectedLoaderVersions[loader.id] || availableLoaders[`${loader.id}_main`]}
                                                                            onChange={(e) => handleLoaderVersionChange(loader.id, e.target.value)}
                                                                            className="w-full p-2 mb-4 bg-bg-surface text-white rounded-lg border-2 border-border-secondary focus:outline-none focus:border-purple-500"
                                                                        >
                                                                            {availableLoaders[loader.id]?.map((version) => (
                                                                            <option key={version} value={version}>
                                                                                {version}
                                                                            </option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {ServerCreateModalState === 'input_name' && (
                                                    <div>
                                                        <div className="flex gap-6 mb-6">
                                                            {/* Left - Thumbnail Preview */}
                                                            <div className="w-1/3">
                                                                <h2 className="text-lg font-semibold mb-4">{serverThumbnailUrl ? "Public server icon": "Private placeholder icon"}</h2>
                                                                <div className={`w-full aspect-square rounded ${serverThumbnailUrl ? '' : getThumbnailColor(serverName || 'Server')} flex items-center justify-center overflow-hidden transition-colors duration-300`}>
                                                                    {serverThumbnailUrl ? (
                                                                        <img src={serverThumbnailUrl} alt={getInitials(serverName)} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-5xl text-text-primary">{getInitials(serverName || 'Se')}</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Right - Input Fields */}
                                                            <div className="w-2/3">
 
                                                                <h2 className="text-lg font-semibold mb-4">Enter a Public Server Name</h2>
                                                                <input
                                                                    type="text"
                                                                    placeholder={`${selectedLoaderType} ${selectedMcVersion} Server`}
                                                                    className="w-full p-3 mb-4 focus:outline-none bg-bg-surface text-white rounded-lg transition-colors"
                                                                    onChange={(e) => setServerName(e.target.value)}
                                                                />

                                                                <h3 className="text-sm font-semibold mt-2 mb-2 text-text-secondary">Custom Thumbnail URL (Optional)</h3>
                                                                <input
                                                                    type="text"
                                                                    placeholder="https://example.com/image.png"
                                                                    className="w-full p-3 mb-4 focus:outline-none bg-bg-surface text-white rounded-lg transition-colors"
                                                                    onChange={(e) => setServerThumbnailUrl(e.target.value)}
                                                                />

                                                                <p className="text-sm text-text-muted leading-relaxed">
                                                                    <span className="text-text-muted">Add an image link to set your public server icon for players. <a href="#" className="text-text-secondary hover:underline">How?</a></span>
                                                                </p>

                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {ServerCreateModalState === 'select_version' && selectedLoaderType ?
                                                    <div className="flex gap-4">
                                                        <button
                                                            onClick={() => {setServerCreateModalState(false); setServerThumbnailUrl("")}}
                                                            className="flex-1 py-2 bg-bg-surface hover:bg-bg-surface-hover rounded-lg transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => {setServerCreateModalState("input_name"); setServerName(""); setServerThumbnailUrl("")}}
                                                            className="flex-1 py-2 bg-success hover:bg-success-hover rounded-lg transition"
                                                        >
                                                            Confirm
                                                        </button>
                                                    </div>
                                                : ServerCreateModalState === 'input_name' && serverName.length > 0 ?
                                                    <div className="flex gap-4">
                                                        <button
                                                            onClick={() => {setServerCreateModalState(false); setServerThumbnailUrl("")}}
                                                            className="flex-1 py-2 bg-bg-surface hover:bg-bg-surface-hover rounded-lg transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleServerCreateFinal()}
                                                            disabled={!serverName}
                                                            className="flex-1 py-2 bg-success hover:bg-success-hover rounded-lg transition disabled:bg-bg-surface disabled:hover:bg-bg-surface disabled:cursor-not-allowed"
                                                        >
                                                            Create server
                                                        </button>
                                                    </div>
                                                :
                                                    <button
                                                        onClick={() => {setServerCreateModalState(false); setServerThumbnailUrl("")}}
                                                        className="w-full py-2 bg-bg-surface hover:bg-bg-surface rounded-lg transition"
                                                    >
                                                        Cancel
                                                    </button>
                                                }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
