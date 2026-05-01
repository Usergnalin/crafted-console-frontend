import { useState, useEffect, useMemo } from 'react'
import { useTeamConnection } from '../hooks/useTeamConnection.jsx'
import { useTeamData } from '../hooks/useTeamData.jsx'
import { useApi } from '../api/client.jsx'
import ModuleView from './moduleView.jsx'
import { Download, Calendar } from 'lucide-react'

export default function ModuleBrowser({ context, onBack }) {
    const { agentId, serverId, source, teamId } = context
    useTeamConnection(teamId)
    const teamData = useTeamData(teamId)
    const [searchQuery, setSearchQuery] = useState('')
    
    const { client, modrinth_client } = useApi()
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [mcVersions, setMcVersions] = useState([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalHits, setTotalHits] = useState(0)
    const RESULTS_PER_PAGE = 20
    const [versionSearch, setVersionSearch] = useState('')
    const [selectedProjectId, setSelectedProjectId] = useState(null)

    // Fetch MC versions on mount
    useEffect(() => {
        client.get('/version')
            .then(res => setMcVersions(res.data))
            .catch(console.error)
    }, [])

    // Get server properties for default filters
    const serverProperties = useMemo(() => {
        if (source === 'server' && serverId) {
            return teamData?.servers[serverId]?.properties || {}
        }
        return {}
    }, [source, serverId, teamData])

    const tabs = useMemo(() => {
        if (source === "team") {
            return [{ id: 'modpack', label: 'Modpacks' }]
        } else if (source === 'server') {
            const server_loader_type = teamData?.servers[serverId]?.properties?.loader_type
            if (["fabric", "forge", "quilt", "neoforge"].includes(server_loader_type)) {
                return [
                    { id: 'mod', label: 'Mods' },
                    { id: 'resourcepack', label: 'Resource Packs' },
                    { id: 'datapack', label: 'Data Packs' }
                ]
            } else if (["bukkit", "paper"].includes(server_loader_type)) {
                return [
                    { id: 'plugin', label: 'Plugins' },
                    { id: 'resourcepack', label: 'Resource Packs' },
                    { id: 'datapack', label: 'Data Packs' }
                ]
            } else if (["vanilla"].includes(server_loader_type)) {
                return [
                    { id: 'resourcepack', label: 'Resource Packs' },
                    { id: 'datapack', label: 'Data Packs' }
                ]
            }
        }
        return []
    }, [source, serverId, teamData])

    const [activeTab, setActiveTab] = useState(null)

    // Filter state with server-derived defaults
    const [filters, setFilters] = useState({
        versions: [],
        loaders: [],
        clientSide: false,
        serverSide: false
    })

    // Compute default filters from server properties when tab changes
    useEffect(() => {
        if (source === 'server' && serverProperties) {
            const mcVersion = serverProperties.mc_version
            const loaderType = serverProperties.loader_type
            
            let defaultLoaders = []
            if (activeTab === 'mod') {
                // Mods: filter by server loader type
                if (["fabric", "forge", "quilt", "neoforge"].includes(loaderType)) {
                    defaultLoaders = [loaderType]
                }
            } else if (activeTab === 'plugin') {
                // Plugins: filter by server loader type
                if (["bukkit", "paper"].includes(loaderType)) {
                    defaultLoaders = [loaderType === 'paper' ? 'bukkit' : loaderType]
                }
            }
            
            setFilters({
                versions: mcVersion ? [mcVersion] : [],
                loaders: defaultLoaders,
                clientSide: false,
                serverSide: false
            })
        } else {
            // Modpack view - no default filters
            setFilters({ versions: [], loaders: [], clientSide: false, serverSide: false })
        }
    }, [activeTab, serverProperties, source])

    useEffect(() => {
        if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
            setActiveTab(tabs[0].id)
        }
    }, [tabs, activeTab])

    // Build facets array for search
    const buildFacets = () => {
        const facetGroups = [[`project_type:${activeTab}`]]
        
        if (filters.loaders.length > 0) {
            facetGroups.push(filters.loaders.map(l => `categories:${l}`))
        }
        if (filters.versions.length > 0) {
            facetGroups.push(filters.versions.map(v => `versions:${v}`))
        }
        
        // Environment filters: neither or both selected = no filter
        const { clientSide, serverSide } = filters
        if (clientSide !== serverSide) {
            // Only one is selected
            if (clientSide) facetGroups.push(['client_side:required'])
            if (serverSide) facetGroups.push(['server_side:required'])
        }
        // If both true or both false, no environment facet added
        
        return encodeURIComponent(JSON.stringify(facetGroups))
    }

    // Reset to page 1 when search/filters/tab change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, activeTab, filters])

    useEffect(() => {
        if (!activeTab) return
        
        const fetchProjects = async () => {
            setLoading(true)
            try {
                const facets = buildFacets()
                const queryParam = searchQuery ? `&query=${encodeURIComponent(searchQuery)}` : ''
                const offset = (currentPage - 1) * RESULTS_PER_PAGE
                const response = await modrinth_client.get(
                    `https://api.modrinth.com/v2/search?facets=${facets}${queryParam}&limit=${RESULTS_PER_PAGE}&offset=${offset}&index=downloads`
                )
                setResults(response.data.hits || [])
                setTotalHits(response.data.total_hits || 0)
            } catch (error) {
                console.error('Failed to fetch projects:', error)
                setResults([])
                setTotalHits(0)
            } finally {
                setLoading(false)
            }
        }

        const timeout = setTimeout(fetchProjects, 500)
        return () => clearTimeout(timeout)
    }, [searchQuery, activeTab, filters, currentPage])

    const handleProjectClick = (projectId) => {
        setSelectedProjectId(projectId)
    }

    // Available loader options for mods
    const modLoaderOptions = ['fabric', 'forge', 'neoforge', 'quilt']

    // Filter sidebar component
    const FilterSidebar = () => {
        const filteredVersions = mcVersions.filter(v => 
            v.toLowerCase().includes(versionSearch.toLowerCase())
        )
        
        return (
            <div className="w-60 bg-bg-card rounded-lg p-4 flex-shrink-0 max-h-[calc(90vh-200px)] overflow-y-auto">
                <h3 className="font-semibold text-text-primary mb-4">Filters</h3>
                
                {/* Versions Filter - Show for mod, plugin, and modpack */}
                {(activeTab === 'mod' || activeTab === 'plugin' || activeTab === 'modpack') && (
                    <div className="mb-4">
                        <label className="text-sm text-text-primary block mb-2">Minecraft Versions</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                        {filters.versions.map((v, i) => (
                            <span key={i} className="text-xs bg-bg-surface text-text-primary px-2 py-1 rounded flex items-center gap-1">
                                {v}
                                <button
                                    onClick={() => setFilters(f => ({...f, versions: f.versions.filter((_, idx) => idx !== i)}))}
                                    className="text-text-muted hover:text-red-400"
                                >×</button>
                            </span>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Search versions..."
                        value={versionSearch}
                        onChange={(e) => setVersionSearch(e.target.value)}
                        className="w-full p-2 bg-bg-surface text-sm text-text-primary rounded border border-border-secondary focus:border-accent-primary outline-none mb-2"
                    />
                    <div className="max-h-32 overflow-y-auto bg-bg-secondary rounded border border-border-secondary">
                        {filteredVersions.map(v => (
                            <button
                                key={v}
                                onClick={() => {
                                    if (!filters.versions.includes(v)) {
                                        setFilters(f => ({...f, versions: [...f.versions, v]}))
                                    }
                                }}
                                className={`w-full text-left px-2 py-1 text-sm ${
                                    filters.versions.includes(v)
                                        ? 'bg-accent-primary text-text-primary'
                                        : 'text-text-primary hover:bg-bg-surface'
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    </div>
                )}

                {/* Loader Filter - Selectable options for mods */}
                {activeTab === 'mod' && (
                    <div className="mb-4">
                        <label className="text-sm text-text-primary block mb-2">Loader Type</label>
                        <div className="flex flex-wrap gap-1">
                            {modLoaderOptions.map(loader => (
                                <button
                                    key={loader}
                                    onClick={() => {
                                        setFilters(f => ({
                                            ...f, 
                                            loaders: f.loaders.includes(loader)
                                                ? f.loaders.filter(l => l !== loader)
                                                : [...f.loaders, loader]
                                        }))
                                    }}
                                    className={`text-xs px-2 py-1 rounded capitalize transition-colors ${
                                        filters.loaders.includes(loader)
                                            ? 'bg-accent-primary text-text-primary'
                                            : 'bg-bg-surface text-text-primary hover:bg-bg-card-hover'
                                    }`}
                                >
                                    {loader}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Modpack Loader Filter */}
                {activeTab === 'modpack' && (
                    <div className="mb-4">
                        <label className="text-sm text-[#6d5da8] block mb-2">Loader Type</label>
                        <div className="flex flex-wrap gap-1">
                            {modLoaderOptions.map(loader => (
                                <button
                                    key={loader}
                                    onClick={() => {
                                        setFilters(f => ({
                                            ...f, 
                                            loaders: f.loaders.includes(loader)
                                                ? f.loaders.filter(l => l !== loader)
                                                : [...f.loaders, loader]
                                        }))
                                    }}
                                    className={`text-xs px-2 py-1 rounded capitalize transition-colors ${
                                        filters.loaders.includes(loader)
                                            ? 'bg-accent-primary text-text-primary'
                                            : 'bg-bg-surface text-text-primary hover:bg-bg-card-hover'
                                    }`}
                                >
                                    {loader}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Plugin loader - read only */}
                {activeTab === 'plugin' && filters.loaders.length > 0 && (
                    <div className="mb-4">
                        <label className="text-sm text-text-muted block mb-2">Loader Type</label>
                        <div className="flex flex-wrap gap-1">
                            {filters.loaders.map(l => (
                                <span key={l} className="text-xs bg-bg-card text-text-primary px-2 py-1 rounded capitalize">
                                    {l}
                                </span>
                            ))}
                        </div>
                        <p className="text-xs text-text-muted mt-1">Based on server type</p>
                    </div>
                )}

                {/* Environment Toggles - Client and Server side */}
                {(activeTab === 'mod' || activeTab === 'plugin') && (
                    <div className="mb-4">
                        <label className="text-sm text-text-primary block mb-2">Environment</label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.clientSide}
                                    onChange={(e) => setFilters(f => ({...f, clientSide: e.target.checked}))}
                                    className="w-4 h-4 rounded bg-bg-surface border-accent-primary text-text-primary focus:ring-accent-primary"
                                />
                                <span className="text-sm text-text-primary">Client-side</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.serverSide}
                                    onChange={(e) => setFilters(f => ({...f, serverSide: e.target.checked}))}
                                    className="w-4 h-4 rounded bg-bg-surface border-accent-primary text-text-primary focus:ring-accent-primary"
                                />
                                <span className="text-sm text-text-primary">Server-side</span>
                            </label>
                        </div>
                        <p className="text-xs text-text-muted mt-2">
                            Select neither or both for no filter
                        </p>
                    </div>
                )}

                {/* Reset Button */}
                <button
                    onClick={() => {
                        const mcVersion = serverProperties.mc_version
                        const loaderType = serverProperties.loader_type
                        let defaultLoaders = []
                        if (activeTab === 'mod' && ["fabric", "forge", "quilt", "neoforge"].includes(loaderType)) {
                            defaultLoaders = [loaderType]
                        } else if (activeTab === 'plugin' && ["bukkit", "paper"].includes(loaderType)) {
                            defaultLoaders = [loaderType === 'paper' ? 'bukkit' : loaderType]
                        }
                        setFilters({
                            versions: (activeTab === 'mod' || activeTab === 'plugin') && mcVersion ? [mcVersion] : [],
                            loaders: defaultLoaders,
                            clientSide: false,
                            serverSide: activeTab === 'mod' || activeTab === 'plugin'
                        })
                        setVersionSearch('')
                    }}
                    className="w-full py-2 text-sm bg-bg-surface text-text-primary rounded hover:bg-bg-card-hover transition-colors"
                >
                    Reset Filters
                </button>
            </div>
        )
    }

    return (
        <div className="max-h-[90vh] overflow-y-auto pr-2 px-3">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="px-3 py-1.5 text-sm font-medium bg-bg-surface text-text-primary rounded-lg hover:bg-bg-card-hover transition-colors border-2 border-border-primary"
                >
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-text-primary">
                    {source === 'server' ? 'Browse Modules' : 'Install Modpack'}
                </h1>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-3 bg-bg-input text-text-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all duration-200"
                />
            </div>

            <div className="flex gap-2 mb-6">
                {tabs.length > 1 && tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'bg-accent-primary text-text-primary'
                                : 'bg-bg-surface text-text-secondary hover:bg-bg-card-hover'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex gap-4">
                {/* Left Sidebar - Filters */}
                {source === 'server' && <FilterSidebar />}

                {/* Main Content - Results */}
                <div className="flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                            {results.map(project => (
                                <div key={project.project_id}>
                                    <button
                                        className="flex gap-4 bg-bg-surface text-left w-full rounded-lg p-2 hover:bg-bg-card-hover transition-colors cursor-pointer"
                                        onClick={() => handleProjectClick(project.project_id)}
                                    >
                                        {/* Left Column: Square Icon */}
                                        <div className="shrink-0 w-25 h-25">
                                            {project.icon_url ? (
                                            <img
                                                src={project.icon_url}
                                                alt={project.title}
                                                className="w-full h-full rounded-lg object-cover"
                                            />
                                            ) : (
                                            <div className="w-full h-full bg-bg-card rounded-lg flex items-center justify-center text-text-muted text-xs">
                                                No Icon
                                            </div>
                                            )}
                                        </div>

                                        {/* Right Column: Content */}
                                        <div className="flex p-1 flex-col justify-between min-w-0">
                                            <div>
                                                <h3 className="text-text-primary truncate">
                                                    <span className="text-lg font-semibold font-normal">{project.title}</span>
                                                    <span className="text-sm font-normal ml-1 opacity-70">by {project.author}</span>
                                                </h3>
                                                <p className="text-sm opacity-70 line-clamp-2">{project.description}</p>
                                            </div>
                                                
                                            {/* Stats Row */}
                                            <div className="flex items-center gap-4 text-xs text-text-muted mt-3">
                                                <div className="flex items-center gap-1">
                                                    <Download size={14} />
                                                    <span>{project.downloads.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={14} />
                                                    <span>{project.date_modified}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Project Details Modal - Outside the grid */}
                    {selectedProjectId && (
                        <ModuleView
                            teamId={teamId}
                            agentId={agentId}
                            serverId={serverId}
                            projectId={selectedProjectId}
                            onClose={() => setSelectedProjectId(null)}
                        />
                    )}

                    {!loading && results.length === 0 && (
                        <p className="text-center text-text-muted py-12">No projects found</p>
                    )}

                    {/* Pagination */}
                    {!loading && totalHits > 0 && (
                        <div className="flex justify-center items-center gap-2 mt-8">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm bg-bg-surface text-text-primary rounded hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Prev
                            </button>
                            
                            {(() => {
                                const totalPages = Math.ceil(totalHits / RESULTS_PER_PAGE)
                                const pages = []
                                const maxVisible = 5
                                
                                // Always show first page
                                pages.push(
                                    <button
                                        key={1}
                                        onClick={() => setCurrentPage(1)}
                                        className={`px-3 py-1 text-sm rounded ${
                                            currentPage === 1
                                                ? 'bg-accent-primary text-text-primary'
                                                : 'bg-bg-surface text-text-primary hover:bg-bg-card-hover'
                                        }`}
                                    >
                                        1
                                    </button>
                                )
                                
                                // Calculate range around current page
                                let start = Math.max(2, currentPage - Math.floor(maxVisible / 2))
                                let end = Math.min(totalPages - 1, start + maxVisible - 1)
                                
                                if (end - start < maxVisible - 1) {
                                    start = Math.max(2, end - maxVisible + 1)
                                }
                                
                                // Add ellipsis after first page if needed
                                if (start > 2) {
                                    pages.push(<span key="start-ellipsis" className="text-text-muted">...</span>)
                                }
                                
                                // Add middle pages
                                for (let i = start; i <= end; i++) {
                                    pages.push(
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i)}
                                            className={`px-3 py-1 text-sm rounded ${
                                                currentPage === i
                                                    ? 'bg-accent-primary text-text-primary'
                                                    : 'bg-bg-surface text-text-primary hover:bg-bg-card-hover'
                                            }`}
                                        >
                                            {i}
                                        </button>
                                    )
                                }
                                
                                // Add ellipsis before last page if needed
                                if (end < totalPages - 1) {
                                    pages.push(<span key="end-ellipsis" className="text-text-muted">...</span>)
                                }
                                
                                // Always show last page if there's more than 1 page
                                if (totalPages > 1) {
                                    pages.push(
                                        <button
                                            key={totalPages}
                                            onClick={() => setCurrentPage(totalPages)}
                                            className={`px-3 py-1 text-sm rounded ${
                                                currentPage === totalPages
                                                    ? 'bg-accent-primary text-text-primary'
                                                    : 'bg-bg-surface text-text-primary hover:bg-bg-card-hover'
                                            }`}
                                        >
                                            {totalPages}
                                        </button>
                                    )
                                }
                                
                                return pages
                            })()}
                            
                            <button
                                onClick={() => setCurrentPage(p => {
                                    const totalPages = Math.ceil(totalHits / RESULTS_PER_PAGE)
                                    return Math.min(totalPages, p + 1)
                                })}
                                disabled={currentPage >= Math.ceil(totalHits / RESULTS_PER_PAGE)}
                                className="px-3 py-1 text-sm bg-bg-surface text-text-primary rounded hover:bg-bg-card-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
