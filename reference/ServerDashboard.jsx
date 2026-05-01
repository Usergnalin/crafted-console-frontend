import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../lib/api';
import { ModuleInstaller } from './ModuleInstaller';

function getStatusColor(status) {
  switch (status) {
    case 'online': return '#90ee90';
    case 'starting': return '#ffe4b5';
    case 'stopping': return '#ffcccb';
    case 'offline': return '#d3d3d3';
    default: return '#d3d3d3';
  }
}

export function ServerDashboard({ server, agent, apiFetch, onBack, onCommandError }) {
  // Server details state with live updates from SSE
  const [serverDetails, setServerDetails] = useState(server);

  // Log state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logError, setLogError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [oldestLineNumber, setOldestLineNumber] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // MC Command state
  const [mcCommand, setMcCommand] = useState('');
  const [sendingCommand, setSendingCommand] = useState(false);

  // Mods state
  const [mods, setMods] = useState([]);

  // Delete confirmations state
  const [showDeleteServerConfirm, setShowDeleteServerConfirm] = useState(false);
  const [deleteServerText, setDeleteServerText] = useState('');
  const [deletingServer, setDeletingServer] = useState(false);
  const [deleteModConfirmId, setDeleteModConfirmId] = useState(null);
  const [deletingModId, setDeletingModId] = useState(null);

  // Toggle module state
  const [togglingModId, setTogglingModId] = useState(null);

  // Module installer state
  const [showModuleInstaller, setShowModuleInstaller] = useState(false);

  // Installed mods search state
  const [installedModSearch, setInstalledModSearch] = useState('');

  // Refs
  const logContainerRef = useRef(null);
  const logEventSourceRef = useRef(null);
  const serverEventSourceRef = useRef(null);
  const modsEventSourceRef = useRef(null);
  const scrollPositionRef = useRef({ scrollTop: 0, scrollHeight: 0 });
  const isUserScrollingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const scrollHeightBeforeRef = useRef(0);
  const isLoadingOlderRef = useRef(false);

  // Fetch server details and connect to streams
  useEffect(() => {
    fetchServerDetails();
    fetchMods();
    connectLogStream();
    connectServerStream();
    connectModsStream();

    return () => {
      if (logEventSourceRef.current) {
        logEventSourceRef.current.close();
        logEventSourceRef.current = null;
      }
      if (serverEventSourceRef.current) {
        serverEventSourceRef.current.close();
        serverEventSourceRef.current = null;
      }
      if (modsEventSourceRef.current) {
        modsEventSourceRef.current.close();
        modsEventSourceRef.current = null;
      }
    };
  }, [server.server_id]);

  // Fetch mods list
  const fetchMods = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/module/server/${server.server_id}`);
      if (response.ok) {
        const data = await response.json();
        setMods(data);
      }
    } catch (err) {
      // Silent fail
    }
  };

  // Connect to mods SSE stream
  const connectModsStream = () => {
    const url = `${API_BASE}/module/server/${server.server_id}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    modsEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const action = data._action;

        if (action === 'update') {
          // Update mods list
          const { _action, ...modData } = data;
          if (Array.isArray(modData.modules)) {
            // Full list update
            setMods(modData.modules);
          } else if (data.module_id && 'module_enabled' in data) {
            // Individual module enabled state update
            setMods(prev => prev.map(m =>
              m.module_id === data.module_id
                ? { ...m, module_enabled: data.module_enabled }
                : m
            ));
          }
        } else if (action === 'delete') {
          if (data.module_id) {
            // Single mod deleted - remove it from the list
            setMods(prev => prev.filter(m => m.module_id !== data.module_id));
          } else {
            // Server deleted - clear all mods
            setMods([]);
          }
        } else if (Array.isArray(data)) {
          // Direct array of mods
          setMods(data);
        } else if (data.modules) {
          setMods(data.modules);
        }
      } catch (err) {
        // Ignore parse errors
      }
    };
  };

  // Fetch server details from REST endpoint
  const fetchServerDetails = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/server/${server.server_id}`);
      if (response.ok) {
        const data = await response.json();
        setServerDetails(data);
      }
    } catch (err) {
      // Silent fail - use prop data as fallback
    }
  };

  // Connect to server SSE stream for updates/deletes
  const connectServerStream = () => {
    const url = `${API_BASE}/server/${server.server_id}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    serverEventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const action = data._action;

        if (action === 'update') {
          // Update event - merge the data (excluding _action) into server details
          const { _action, ...serverData } = data;
          setServerDetails(prev => ({ ...prev, ...serverData }));
        } else if (action === 'delete') {
          // Delete event - navigate back
          onBack?.();
        } else {
          // Generic update without _action - merge all data
          setServerDetails(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        // Ignore parse errors
      }
    };
  };

  const connectLogStream = () => {
    setLogsLoading(true);
    setLogError(null);

    // Close existing connection
    if (logEventSourceRef.current) {
      logEventSourceRef.current.close();
    }

    const url = `${API_BASE}/server/logs/${server.server_id}/stream?logs_history_lines=100`;
    const es = new EventSource(url, { withCredentials: true });
    logEventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setLogsLoading(false);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { logs: logContent, logs_start_line } = data;

        if (!logContent) return;

        // Check for log rotation signal - server restart, flush remaining, new logs incoming
        if (logContent.includes('log_rotation')) {
          // Clear all logs and reset for new log stream starting at line 1
          setLogs([]);
          setOldestLineNumber(1);
          return;
        }

        // Parse log lines - use \n to count actual lines in this chunk
        const lines = logContent.split('\n').filter(line => line.length > 0);

        // Build log entries with correct line numbers based on starting index
        const logEntries = lines.map((line, index) => ({
          lineNumber: logs_start_line + index,
          content: line,
        }));

        // Check if these are older logs (start line is less than current oldest)
        const currentOldest = oldestLineNumber || Infinity;
        const isOlderLogs = logs_start_line < currentOldest;

        // If loading older logs, save scroll height before state update
        if (isOlderLogs && logContainerRef.current) {
          isLoadingOlderRef.current = true;
          scrollHeightBeforeRef.current = logContainerRef.current.scrollHeight;
        }

        // Merge new logs with existing using functional state update
        setLogs(prevLogs => {
          // Create a map of existing logs by line number for quick lookup
          const logMap = new Map(prevLogs.map(l => [l.lineNumber, l]));

          // Add/update logs from this chunk
          logEntries.forEach(entry => {
            logMap.set(entry.lineNumber, entry);
          });

          // Convert back to array and sort by line number
          const merged = Array.from(logMap.values());
          merged.sort((a, b) => a.lineNumber - b.lineNumber);

          return merged;
        });

        // Update oldest line number
        if (logEntries.length > 0) {
          setOldestLineNumber(prev => {
            const minLine = logEntries[0].lineNumber;
            return prev === null ? minLine : Math.min(prev, minLine);
          });
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      setLogError('Log stream connection lost. Retrying...');
      setLogsLoading(false);
    };
  };

  // Handle scroll position after logs update
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    if (isLoadingOlderRef.current) {
      // Restore scroll position when older logs were loaded
      // Add the difference in scroll height to maintain the same view
      const newScrollHeight = container.scrollHeight;
      const heightDiff = newScrollHeight - scrollHeightBeforeRef.current;
      container.scrollTop = scrollPositionRef.current.scrollTop + heightDiff;
      isLoadingOlderRef.current = false;
    } else if (shouldAutoScrollRef.current) {
      // Auto-scroll to bottom for new logs
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  // Handle scroll events for loading older logs
  const handleScroll = useCallback(() => {
    const container = logContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;

    shouldAutoScrollRef.current = isAtBottom;
    scrollPositionRef.current = { scrollTop, scrollHeight };

    // Load older logs when user scrolls near top (within first 200 pixels)
    // and we haven't reached the beginning (oldestLineNumber > 1)
    if (scrollTop < 200 && oldestLineNumber > 1 && !loadingOlder) {
      loadOlderLogs();
    }
  }, [oldestLineNumber, loadingOlder]);

  const loadOlderLogs = async () => {
    if (oldestLineNumber === null || oldestLineNumber <= 1) return;

    setLoadingOlder(true);

    // Calculate range to load (100 lines before current oldest)
    const endLine = oldestLineNumber - 1;
    const startLine = Math.max(1, endLine - 100);

    const commandData = {
      command: {
        type: 'send_server_logs',
        server_id: server.server_id,
        logs_start_line: startLine,
        logs_end_line: endLine,
      },
    };

    try {
      const response = await apiFetch(`${API_BASE}/command/${agent.agent_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error('Failed to load older logs');
      }

      // The requested logs will arrive via the SSE stream
      // No need to parse response - logs will be merged automatically
    } catch (err) {
      if (err.message === 'Session expired') {
        window.location.reload();
      } else {
        onCommandError?.(err.message);
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  // Send server commands
  const handleServerCommand = async (action) => {
    const commandType = `${action}_server`;
    const commandData = {
      command: {
        type: commandType,
        server_id: serverDetails.server_id || server.server_id,
      },
    };

    try {
      const response = await apiFetch(`${API_BASE}/command/${agent.agent_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} server`);
      }
    } catch (err) {
      if (err.message === 'Session expired') {
        window.location.reload();
      } else {
        onCommandError?.(err.message);
      }
    }
  };

  // Send MC command
  const handleSendMcCommand = async (e) => {
    e.preventDefault();
    if (!mcCommand.trim()) return;

    setSendingCommand(true);

    const commandData = {
      command: {
        type: 'mc_command',
        server_id: serverDetails.server_id || server.server_id,
        command: mcCommand.trim(),
      },
    };

    try {
      const response = await apiFetch(`${API_BASE}/command/${agent.agent_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error('Failed to send command');
      }

      // Clear input on success
      setMcCommand('');
    } catch (err) {
      if (err.message === 'Session expired') {
        window.location.reload();
      } else {
        onCommandError?.(err.message);
      }
    } finally {
      setSendingCommand(false);
    }
  };

  // Delete server with confirmation
  const handleDeleteServer = async (e) => {
    e.preventDefault();
    if (deleteServerText !== 'DELETE FOREVER') return;

    setDeletingServer(true);
    const commandData = {
      command: {
        type: 'delete_server',
        server_id: serverDetails.server_id || server.server_id,
      },
    };

    try {
      const response = await apiFetch(`${API_BASE}/command/${agent.agent_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error('Failed to delete server');
      }

      onBack?.();
    } catch (err) {
      if (err.message === 'Session expired') {
        window.location.reload();
      } else {
        onCommandError?.(err.message);
      }
    } finally {
      setDeletingServer(false);
    }
  };

  // Delete mod with confirmation
  const handleDeleteMod = async (modId) => {
    setDeletingModId(modId);
    const commandData = {
      command: {
        type: 'delete_module',
        server_id: serverDetails.server_id || server.server_id,
        module_id: modId,
      },
    };

    try {
      const response = await apiFetch(`${API_BASE}/command/${agent.agent_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error('Failed to delete mod');
      }

      setDeleteModConfirmId(null);
    } catch (err) {
      if (err.message === 'Session expired') {
        window.location.reload();
      } else {
        onCommandError?.(err.message);
      }
    } finally {
      setDeletingModId(null);
    }
  };

  // Toggle module enable/disable
  const handleToggleMod = async (modId, isEnabled) => {
    setTogglingModId(modId);
    const commandType = isEnabled ? 'disable_module' : 'enable_module';
    const commandData = {
      command: {
        type: commandType,
        server_id: serverDetails.server_id || server.server_id,
        module_id: modId,
      },
    };

    try {
      const response = await apiFetch(`${API_BASE}/command/${agent.agent_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${isEnabled ? 'disable' : 'enable'} mod`);
      }
    } catch (err) {
      if (err.message === 'Session expired') {
        window.location.reload();
      } else {
        onCommandError?.(err.message);
      }
    } finally {
      setTogglingModId(null);
    }
  };

  // Show ModuleInstaller if active
  if (showModuleInstaller) {
    console.log(mods)
    return (
      <ModuleInstaller
        server={server}
        agent={agent}
        apiFetch={apiFetch}
        installedMods={mods}
        onBack={() => setShowModuleInstaller(false)}
        onCommandError={onCommandError}
      />
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '15px 20px',
        background: '#f5f5f5',
        borderBottom: '1px solid #ddd',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 12px',
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ← Back to Servers
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{serverDetails.server_name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: getStatusColor(serverDetails.server_status),
                  fontSize: '12px',
                  textTransform: 'uppercase',
                }}
              >
                {serverDetails.server_status}
              </span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {isConnected ? '🟢 Log Connected' : '🔴 Log Disconnected'}
              </span>
              {serverDetails.properties?.['server-port'] && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  Port: {serverDetails.properties['server-port']}
                </span>
              )}
              {serverDetails.properties?.['mc_version'] && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  MC: {serverDetails.properties['mc_version']}
                </span>
              )}
              {serverDetails.properties?.['loader_type'] && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  Loader: {serverDetails.properties['loader_type']}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleServerCommand('start')}
            disabled={serverDetails.server_status === 'online' || serverDetails.server_status === 'starting'}
            style={{
              padding: '10px 20px',
              background: serverDetails.server_status === 'online' || serverDetails.server_status === 'starting' ? '#ccc' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: serverDetails.server_status === 'online' || serverDetails.server_status === 'starting' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            ▶ Start
          </button>
          <button
            onClick={() => handleServerCommand('stop')}
            disabled={serverDetails.server_status === 'offline' || serverDetails.server_status === 'stopping'}
            style={{
              padding: '10px 20px',
              background: serverDetails.server_status === 'offline' || serverDetails.server_status === 'stopping' ? '#ccc' : '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: serverDetails.server_status === 'offline' || serverDetails.server_status === 'stopping' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            ⏹ Stop
          </button>
          <button
            onClick={() => handleServerCommand('restart')}
            disabled={serverDetails.server_status === 'offline' || serverDetails.server_status === 'starting' || serverDetails.server_status === 'stopping'}
            style={{
              padding: '10px 20px',
              background: serverDetails.server_status === 'offline' || serverDetails.server_status === 'starting' || serverDetails.server_status === 'stopping' ? '#ccc' : '#FF9800',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: serverDetails.server_status === 'offline' || serverDetails.server_status === 'starting' || serverDetails.server_status === 'stopping' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            ↻ Restart
          </button>
        </div>
      </div>

      {/* Logs Section */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '10px 20px',
          background: '#fafafa',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Server Logs</span>
          {loadingOlder && (
            <span style={{ fontSize: '12px', color: '#666' }}>Loading older logs...</span>
          )}
        </div>

        {logsLoading ? (
          <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Connecting to log stream...
          </div>
        ) : logError ? (
          <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f44336' }}>
            {logError}
          </div>
        ) : (
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            style={{
              height: '60vh',
              overflow: 'auto',
              padding: '10px 20px',
              background: '#1e1e1e',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
            }}
          >
            {/* Loading indicator at top */}
            {loadingOlder && (
              <div style={{ textAlign: 'center', padding: '10px', color: '#888' }}>
                Loading older logs...
              </div>
            )}

            {/* No more logs indicator */}
            {oldestLineNumber === 1 && logs.length > 0 && (
              <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontStyle: 'italic' }}>
                — Beginning of logs —
              </div>
            )}

            {/* Log lines */}
            {logs.map((log, index) => (
              <div
                key={`${log.lineNumber}-${index}`}
                style={{
                  display: 'flex',
                  gap: '10px',
                  color: '#d4d4d4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <span style={{ color: '#666', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>
                  {log.lineNumber}
                </span>
                <span>{log.content}</span>
              </div>
            ))}

            {logs.length === 0 && (
              <div style={{ textAlign: 'center', color: '#666', paddingTop: '40px' }}>
                {isConnected ? 'Waiting for logs...' : 'Connecting to log stream...'}
              </div>
            )}
          </div>
        )}

        {/* MC Command Input */}
        <form
          onSubmit={handleSendMcCommand}
          style={{
            display: 'flex',
            gap: '10px',
            padding: '15px 20px',
            background: '#f5f5f5',
            borderTop: '1px solid #ddd',
          }}
        >
          <input
            type="text"
            value={mcCommand}
            onChange={(e) => setMcCommand(e.target.value)}
            placeholder="Enter Minecraft command (e.g., /op usergnalin)"
            disabled={sendingCommand || serverDetails.server_status !== 'online'}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              background: serverDetails.server_status !== 'online' ? '#eee' : '#fff',
            }}
          />
          <button
            type="submit"
            disabled={sendingCommand || !mcCommand.trim() || serverDetails.server_status !== 'online'}
            style={{
              padding: '10px 20px',
              background: sendingCommand || serverDetails.server_status !== 'online' ? '#ccc' : '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: sendingCommand || serverDetails.server_status !== 'online' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {sendingCommand ? 'Sending...' : 'Send Command'}
          </button>
        </form>
      </div>

      {/* Mods Section */}
      <div style={{
        padding: '15px 20px',
        background: '#fafafa',
        borderTop: '1px solid #ddd',
        maxHeight: '400px',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '14px' }}>
            Mods ({mods.length})
          </h4>
          <button
            onClick={() => setShowModuleInstaller(true)}
            style={{
              padding: '6px 12px',
              background: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            + Add Modules
          </button>
        </div>

        {/* Search installed mods */}
        {mods.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              value={installedModSearch}
              onChange={(e) => setInstalledModSearch(e.target.value)}
              placeholder="Search installed modules..."
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {(() => {
          // Sort and filter mods
          const filteredMods = mods
            .filter(mod =>
              installedModSearch === '' ||
              mod.module_name.toLowerCase().includes(installedModSearch.toLowerCase())
            )
            .sort((a, b) => a.module_name.localeCompare(b.module_name, undefined, { sensitivity: 'base' }));

          if (filteredMods.length === 0) {
            return (
              <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                {mods.length === 0 ? 'No mods installed' : 'No mods match your search'}
              </p>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredMods.map((mod) => (
              <div
                key={mod.module_id}
                style={{
                  padding: '6px 10px',
                  background: mod.module_enabled ? '#fff' : '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  {mod.module_metadata?.icon_url && (
                    <img
                      src={mod.module_metadata.icon_url}
                      alt=""
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <span style={{
                    fontWeight: '500',
                    color: mod.module_enabled ? '#000' : '#999',
                    textDecoration: mod.module_enabled ? 'none' : 'line-through',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {mod.module_name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    color: mod.module_enabled ? '#666' : '#999',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                  }}>
                    {mod.module_enabled ? mod.module_type : 'disabled'}
                  </span>
                  {deleteModConfirmId === mod.module_id ? (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        onClick={() => handleDeleteMod(mod.module_id)}
                        disabled={deletingModId === mod.module_id}
                        style={{
                          padding: '4px 8px',
                          background: deletingModId === mod.module_id ? '#ccc' : '#f44336',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: deletingModId === mod.module_id ? 'not-allowed' : 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        {deletingModId === mod.module_id ? '...' : 'Sure?'}
                      </button>
                      <button
                        onClick={() => setDeleteModConfirmId(null)}
                        disabled={deletingModId === mod.module_id}
                        style={{
                          padding: '4px 8px',
                          background: '#666',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggleMod(mod.module_id, mod.module_enabled)}
                        disabled={togglingModId === mod.module_id}
                        style={{
                          padding: '4px 8px',
                          background: togglingModId === mod.module_id ? '#ccc' : (mod.module_enabled ? '#9C27B0' : '#4CAF50'),
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: togglingModId === mod.module_id ? 'not-allowed' : 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        {togglingModId === mod.module_id ? '...' : (mod.module_enabled ? 'Disable' : 'Enable')}
                      </button>
                      <button
                        onClick={() => setDeleteModConfirmId(mod.module_id)}
                        style={{
                          padding: '4px 8px',
                          background: '#ff9800',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </div>

      {/* Delete Server Section */}
      <div style={{
        padding: '15px 20px',
        background: '#fff5f5',
        borderTop: '2px solid #ffcccc',
      }}>
        {!showDeleteServerConfirm ? (
          <button
            onClick={() => setShowDeleteServerConfirm(true)}
            style={{
              padding: '10px 20px',
              background: '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              width: '100%',
            }}
          >
            ⚠ Delete Server
          </button>
        ) : (
          <form onSubmit={handleDeleteServer} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#d32f2f' }}>
              <strong>Danger:</strong> Type "DELETE FOREVER" to confirm server deletion. This cannot be undone!
            </p>
            <input
              type="text"
              value={deleteServerText}
              onChange={(e) => setDeleteServerText(e.target.value)}
              placeholder="DELETE FOREVER"
              disabled={deletingServer}
              style={{
                padding: '10px',
                border: '1px solid #d32f2f',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={deleteServerText !== 'DELETE FOREVER' || deletingServer}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: deleteServerText !== 'DELETE FOREVER' || deletingServer ? '#ccc' : '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: deleteServerText !== 'DELETE FOREVER' || deletingServer ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {deletingServer ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteServerConfirm(false);
                  setDeleteServerText('');
                }}
                disabled={deletingServer}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#666',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: deletingServer ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
