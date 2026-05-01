import { useState } from 'react'
import { Play, Square, RotateCcw, Skull, Send, AlertTriangle } from 'lucide-react'
import LogViewer from '../logViewer.jsx'

export default function OverviewTab({ server, agentId, serverId, auth_client }) {
    const [loadingAction, setLoadingAction] = useState(false)
    const [commandInput, setCommandInput] = useState('')
    const [killWarning, setKillWarning] = useState(false)

    const status = server?.server_status || 'unknown'

    const handleAction = (action) => {
        setLoadingAction(true)
        auth_client.post(`/command/${agentId}`, {
            command: { type: action, server_id: serverId }
        }).finally(() => {
            setTimeout(() => setLoadingAction(false), 2000)
        })
    }

    const handleSendCommand = () => {
        if (!commandInput.trim()) return
        auth_client.post(`/command/${agentId}`, {
            command: { type: 'mc_command', server_id: serverId, command: commandInput.trim() }
        }).then(() => {
            setCommandInput('')
        }).catch((err) => {
            console.error('Failed to send command:', err)
        })
    }

    return (
        <div>

            {/* Control Buttons Row */}
            <div className="flex gap-3 mb-6">
                {/* Start */}
                <button
                    onClick={() => handleAction('start_server')}
                    disabled={status !== 'offline' || loadingAction}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        status === 'offline' && !loadingAction
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-600 cursor-not-allowed text-gray-300'
                    }`}
                >
                    <Play size={18} />
                    Start
                </button>

                {/* Stop */}
                <button
                    onClick={() => handleAction('stop_server')}
                    disabled={status !== 'online' || loadingAction}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        status === 'online' && !loadingAction
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-gray-600 cursor-not-allowed text-gray-300'
                    }`}
                >
                    <Square size={18} />
                    Stop
                </button>

                {/* Restart */}
                <button
                    onClick={() => handleAction('restart_server')}
                    disabled={status !== 'online' || loadingAction}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        status === 'online' && !loadingAction
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-gray-600 cursor-not-allowed text-gray-300'
                    }`}
                >
                    <RotateCcw size={18} />
                    Restart
                </button>

                {/* Kill */}
                <button
                    onClick={() => setKillWarning(true)}
                    disabled={status === 'offline' || loadingAction}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        status !== 'offline' && !loadingAction
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-gray-600 cursor-not-allowed text-gray-300'
                    }`}
                >
                    <Skull size={18} />
                    Kill
                </button>
            </div>

            {/* Kill Warning Modal */}
            {killWarning && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-bg-card rounded-lg border border-border-secondary p-6 max-w-md">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={24} className="text-red-500" />
                            <h3 className="text-lg font-semibold text-text-primary">Confirm Kill</h3>
                        </div>
                        <p className="text-text-muted mb-6">
                            This action will immediately terminate the server process and may cause{" "}
                            <span className="font-bold text-red-500">corruption</span> of your world.{" "}
                            Are you sure you want to <span className="font-bold">continue</span>?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setKillWarning(false)}
                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setKillWarning(false)
                                    handleAction('kill_server')
                                }}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Kill
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logs Box */}
            <div className="mb-4 h-[40rem]">
                <LogViewer serverId={serverId} />
            </div>

            {/* Command Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
                    placeholder="Enter command..."
                    disabled={status !== 'online'}
                    className="flex-1 p-3 bg-bg-surface text-white rounded-lg border border-border-secondary focus:border-accent-primary outline-none disabled:opacity-50"
                />
                <button
                    onClick={handleSendCommand}
                    disabled={status !== 'online' || !commandInput.trim()}
                    className="px-4 py-2 bg-bg-surface text-white rounded-lg hover:bg-accent-primary transition-colors disabled:bg-bg-secondary disabled:cursor-not-allowed disabled:text-text-muted flex items-center gap-2"
                >
                    <Send size={18} />
                    Send
                </button>
            </div>
        </div>
    )
}
