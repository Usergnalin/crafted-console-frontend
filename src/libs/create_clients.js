import axios from "axios"

export function create_clients(on_refresh_fail) {
    const auth_client = axios.create({
        baseURL: "/api",
        withCredentials: true,
    })

    const client = axios.create({
        baseURL: "/api",
        withCredentials: true,
    })

    const modrinth_client = axios.create({
        baseURL: "https://api.modrinth.com/v2",
        headers: {
            'User-Agent': 'Usergnalin/mc_manager_api (usernilang@gmail.com)'
        }
    })

    let is_refreshing = false
    let query_queue = []

    function process_queue(error) {
        query_queue.forEach(query => {
            if (error) query.reject(error)
            else query.resolve()
        })
        query_queue = []
    }

    const perform_refresh = async () => {
        if (is_refreshing) {
            return new Promise((resolve, reject) => {
                query_queue.push({ resolve, reject })
            })
        }

        is_refreshing = true
        try {
            await client.post("auth/refresh")
            process_queue(null)
        } catch (error) {
            process_queue(error)
            on_refresh_fail()
            throw error
        } finally {
            is_refreshing = false
        }
    };

    auth_client.interceptors.response.use(res => res, async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                await perform_refresh()
                return auth_client(original)
            } catch (error) {
                return Promise.reject(error)
            }
        }
        return Promise.reject(error)
    })

    const create_sse = (path, handlers) => {
        let eventSource = null
        let destroyed = false

        const connect = () => {
            if (destroyed) return
            eventSource = new EventSource(`/api${path}`, { withCredentials: true })
            eventSource.onopen = () => handlers.onOpen?.()
            eventSource.onerror = async () => {
                eventSource.close()
                if (destroyed) return
                let probeStatus = null
                try {
                    await client.get(path)
                } catch (err) {
                    probeStatus = err.response?.status ?? null
                }
                handlers.onError?.(probeStatus)
            }
            for (const [event, handler] of Object.entries(handlers.events ?? {})) {
                eventSource.addEventListener(event, (event) => {
                    try {
                        const data = JSON.parse(event.data)
                        
                        // Check for session expiry message
                        if (data.message === 'Session expired') {
                            handlers.onSessionExpiry?.()
                            return
                        }
                        
                        handler(data)
                    } catch (error) {
                        console.error('Failed to parse SSE event:', error)
                    }
                })
            }
        }
        connect()
        return {
            close: () => {
                destroyed = true
                eventSource?.close()
            }
        }
    }

    return {auth_client, client, modrinth_client, create_sse, perform_refresh}
}
