import { useState } from 'react'
import { useTeamConnection } from '../hooks/useTeamConnection.jsx'
import { useTeamData } from '../hooks/useTeamData.jsx'
import { useApi } from '../api/client.jsx'
import ActionTab from './serverViewTabs/actionTab.jsx'
import ModulesTab from './serverViewTabs/modulesTab.jsx'
import ConfigureTab from './serverViewTabs/configureTab.jsx'

const TABS = [
    { id: 'actions', label: 'Actions' },
    { id: 'modules', label: 'Modules' },
    { id: 'configure', label: 'Configure' },
]

export default function ServerView({ teamId, agentId, serverId, serverName, onBack, onBrowseModules }) {
    useTeamConnection(teamId)
    const teamData = useTeamData(teamId)
    const { auth_client } = useApi()
    const [activeTab, setActiveTab] = useState('actions')

    const server = teamData?.servers?.[serverId]

    const getStatusColor = (s) => {
        switch (s) {
            case 'online': return 'bg-green-500'
            case 'offline': return 'bg-gray-500'
            case 'starting': return 'bg-yellow-500'
            case 'stopping': return 'bg-orange-500'
            default: return 'bg-gray-500'
        }
    }

    const status = server?.server_status || 'unknown'
    const lastOnline = server?.last_online

    return (
        <div className="max-h-[90vh] overflow-y-auto pr-2 pl-4 pr-4">
            {/* Header Row */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={onBack}
                    className="px-3 py-1.5 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                    ← Back
                </button>
                <h1 className="text-3xl font-bold text-text-primary">{serverName}</h1>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full ${getStatusColor(status)}`} />
                    <span className="text-md text-text-primary capitalize">{status}</span>
                </div>

                {/* Last Online (if offline) */}
                {status === 'offline' && lastOnline && (
                    <span className="text-sm text-text-muted">
                        Last online: {new Date(lastOnline).toLocaleString()}
                    </span>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 border-b border-border-secondary">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-t-lg transition-colors ${
                            activeTab === tab.id
                                ? 'bg-bg-card text-text-primary border-t border-l border-r border-border-secondary'
                                : 'text-text-muted hover:text-text-primary'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="pb-4">
                {activeTab === 'actions' && (
                    <ActionTab
                        server={server}
                        agentId={agentId}
                        serverId={serverId}
                        serverName={serverName}
                        auth_client={auth_client}
                        onBrowseModules={onBrowseModules}
                    />
                )}

                {activeTab === 'modules' && (
                    <ModulesTab
                        agentId={agentId}
                        serverId={serverId}
                        teamId={teamId}
                        onBrowseModules={onBrowseModules}
                    />
                )}

                {activeTab === 'configure' && (
                    <ConfigureTab
                        teamId={teamId}
                        agentId={agentId}
                        serverId={serverId}
                        serverName={serverName}
                        auth_client={auth_client}
                        onBack={onBack}
                    />
                )}
            </div>
        </div>
    )
}
