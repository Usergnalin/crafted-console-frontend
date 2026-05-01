import { createContext, useContext, useMemo } from "react"
import { create_clients } from "../libs/create_clients"
import { useNavigate } from "react-router-dom"

const api_context = createContext(null)

export function ApiProvider({ children }) {
  const navigate = useNavigate()

  const clients = useMemo(() => {
    return create_clients(() => {
      navigate("/login")
    })
  }, [navigate])

  return (
    <api_context.Provider value={clients}>
      {children}
    </api_context.Provider>
  )
}

export const useApi = () => useContext(api_context)