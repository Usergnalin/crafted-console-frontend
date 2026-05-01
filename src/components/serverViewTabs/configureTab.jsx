import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'

export default function ConfigureTab({ teamId, agentId, serverId, serverName, auth_client, onBack }) {
    const [deleteConfirmation, setDeleteConfirmation] = useState('')
    const [deleting, setDeleting] = useState(false)

    const handleDeleteServer = async () => {
        if (deleteConfirmation !== 'DELETE FOREVER') return
        
        setDeleting(true)
        try {
            await auth_client.post(`/command/${agentId}`, {
                command: {
                    type: 'delete_server',
                    server_id: serverId
                }
            })
            // Navigate back to team view after successful deletion
            onBack()
        } catch (error) {
            console.error('Failed to delete server:', error)
        } finally {
            setDeleting(false)
        }
    }

    const isDeleteEnabled = deleteConfirmation === 'DELETE FOREVER' && !deleting

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-6">Configure Server</h2>

            {/* Delete Server Section */}
            <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-red-400" size={24} />
                    <h3 className="text-xl font-semibold text-red-400">Delete Server</h3>
                </div>

                <div className="space-y-4">
                    <p className="text-red-300">
                        <strong>Warning:</strong> This action will permanently delete all files associated with this server.
                        This operation is <strong>irreversible</strong> and cannot be undone.
                    </p>

                    <p className="text-gray-300 text-sm">
                        Server to be deleted: <span className="text-white font-medium">{serverName}</span>
                    </p>

                    <div className="space-y-2">
                        <label className="block text-sm text-gray-300">
                            Type <code className="bg-red-900/50 px-2 py-1 rounded text-red-300">DELETE FOREVER</code> to enable deletion:
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="DELETE FOREVER"
                            className="w-full px-4 py-2 bg-bg-modal border border-red-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                        />
                    </div>
                    
                    <button
                        onClick={handleDeleteServer}
                        disabled={!isDeleteEnabled}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            isDeleteEnabled
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {deleting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Deleting Server...
                            </>
                        ) : (
                            <>
                                <Trash2 size={16} />
                                Delete Server
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
