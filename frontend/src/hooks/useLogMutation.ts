import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

export default function useLogMutation(type: string, date: string, onSuccess?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post(`/entries/${type}`, { ...payload, date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      qc.invalidateQueries({ queryKey: ['entries', date] })
      onSuccess?.()
    },
  })
}
