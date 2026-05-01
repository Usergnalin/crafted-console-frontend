import { useEffect, useState } from 'react'
import { useApi } from '../api/client.jsx'
import { useSelectedTeam } from '../hooks/useTeamData.jsx'
import { useNavigate } from 'react-router-dom'
import TeamView from '../components/teamView.jsx'
import ServerView from '../components/serverView.jsx'
import ModuleBrowser from '../components/moduleBrowser.jsx'
import { LogOut } from 'lucide-react'

export default function Dashboard() {
    const [user_data, set_user_data] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const {auth_client, client} = useApi()
    const navigate = useNavigate()

    const { selectedTeam, selectTeam } = useSelectedTeam()

    const [viewStack, setViewStack] = useState([])

    const pushView = (view) => setViewStack(stack => [...stack, view])
    const popView = () => setViewStack(stack => stack.slice(0, -1))
    const currentView = viewStack[viewStack.length - 1] || { type: 'team' }

    useEffect(() => {
        auth_client.get('/user')
        .then(res => {
            set_user_data(res.data)
        })
        .catch(error => {
            setError(error.message)
        })
        .finally(() => {
            setLoading(false)
        })
    }, [])

    const handleLogout = async () => {
        try {
            await client.post('/auth/logout')
            navigate('/login')
        } catch (error) {
            console.error('Logout failed:', error)
            navigate('/login')
        }
    }

    return (
    <div className="flex flex-col h-screen bg-bg-secondary text-text-primary font-sans">
        <nav className="flex items-center justify-between px-6 h-13 bg-bg-secondary border-b border-border-primary">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-secondary">{loading ? 'Loading...' : error ? error : user_data?.username}</span>
            </div>
            <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:text-white hover:bg-bg-surface rounded-lg transition-colors"
            >
                <LogOut size={16} />
                Logout
            </button>
        </nav>

        <div className="flex flex-1 overflow-hidden">

        <aside className="w-52 bg-bg-secondary border-r border-border-primary p-3 overflow-y-auto">
            <p className="text-[10px] font-semibold tracking-widest text-text-muted uppercase px-2 mb-3">Teams</p>
            {loading ? 'Loading...' : error ? error : user_data.teams.map(team => (
                <button
                    key={team.team_id}
                    onClick={() => {
                        selectTeam(team.team_id)
                        setViewStack([]) // Clear view stack to return to team view
                    }}
                    className="w-full text-left px-2 py-2.5 rounded-lg cursor-pointer hover:bg-bg-card mb-1"
                >
                    <p className="text-sm font-medium text-text-secondary">{team.team_name}</p>
                    <p className="text-[11px] text-text-muted font-mono mt-0.5">{team.slug}</p>
                    <p className="text-[11px] text-text-muted font-mono mt-0.5">{team.role}</p>
                </button>
            ))}
        </aside>
        <div className="flex-1 p-4 bg-bg-primary">
            {!selectedTeam ? (
                <p className="text-text-muted">Select a team</p>
            ) : (
                (() => {
                    const teamData = user_data.teams.find(t => t.team_id == selectedTeam)
                    switch (currentView.type) {
                        case 'server':
                            return (
                                <ServerView
                                    teamId={selectedTeam}
                                    agentId={currentView.agentId}
                                    serverId={currentView.serverId}
                                    serverName={currentView.serverName}
                                    onBack={popView}
                                    onBrowseModules={(agentId, serverId) => pushView({
                                        type: 'moduleBrowser',
                                        source: 'server',
                                        agentId,
                                        serverId,
                                        teamId: selectedTeam
                                    })}
                                />
                            )
                        case 'moduleBrowser':
                            return (
                                <ModuleBrowser
                                    context={{ ...currentView, teamId: selectedTeam }}
                                    onBack={popView}
                                />
                            )
                        case 'team':
                        default:
                            return (
                                <TeamView
                                    teamData={teamData}
                                    onSelectServer={(agentId, serverId, serverName) => pushView({
                                        type: 'server',
                                        agentId,
                                        serverId,
                                        serverName
                                    })}
                                    onInstallModpack={(agentId) => pushView({
                                        type: 'moduleBrowser',
                                        source: 'team',
                                        agentId,
                                        teamId: selectedTeam
                                    })}
                                />
                            )
                    }
                })()
            )}
        </div>
        </div>
    </div>
    );
}