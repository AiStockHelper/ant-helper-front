import { useQuery } from '@tanstack/react-query'
import { accountsApi } from '@/api/endpoints'
import type { Account } from '@/api/types'

export function useAccounts() {
  const query = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.list, staleTime: 30_000 })
  const accounts: Account[] = query.data ?? []
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null
  return { ...query, accounts, defaultAccount }
}
