import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import api from '@/api/client'
import Card from '@/components/Card'
import Spinner from '@/components/Spinner'
import useCurrentLocalDate from '@/hooks/useCurrentLocalDate'

type PublicUser = {
  id: number
  username: string
  profile_name: string
}

type Friendship = {
  id: number
  status: 'pending' | 'accepted'
  direction: 'incoming' | 'outgoing'
  user: PublicUser
}

type FriendSummary = {
  friendship_id: number
  user: PublicUser
  calories?: number
  calorie_goal?: number
  macros?: { protein: number; carbs: number; fat: number }
  water?: number
  water_goal?: number
  steps?: number
  step_goal?: number
  sleep?: number
  sleep_goal?: number
  weight_kg?: number | null
  foods?: { id: number; name: string; calories: number }[]
}

type SearchResult = {
  user: PublicUser
  relation: null | { id: number; status: string; direction: 'incoming' | 'outgoing' }
}

function Stat({ label, value, sub, color = 'var(--color-lime)' }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-elevated/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase text-gray-500 truncate">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
    </div>
  )
}

function FriendCard({ friend, onRemove }: { friend: FriendSummary; onRemove: (id: number) => void }) {
  const calorieSub = friend.calorie_goal ? `/ ${friend.calorie_goal} cal` : undefined
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-semibold tracking-tight truncate">{friend.user.profile_name}</p>
          <p className="text-sm text-gray-500 truncate">@{friend.user.username}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(friend.friendship_id)}
          className="min-h-11 min-w-11 rounded-full bg-elevated text-gray-400 flex items-center justify-center"
          aria-label={`Remove ${friend.user.profile_name}`}
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {friend.calories !== undefined && <Stat label="Intake" value={Math.round(friend.calories)} sub={calorieSub} color="var(--color-move)" />}
        {friend.steps !== undefined && <Stat label="Steps" value={friend.steps.toLocaleString()} sub={friend.step_goal ? `/ ${friend.step_goal.toLocaleString()}` : undefined} color="var(--color-stand)" />}
        {friend.water !== undefined && <Stat label="Water" value={`${friend.water} ml`} sub={friend.water_goal ? `/ ${friend.water_goal} ml` : undefined} color="var(--color-info)" />}
        {friend.sleep !== undefined && <Stat label="Sleep" value={`${friend.sleep}h`} sub={friend.sleep_goal ? `/ ${friend.sleep_goal}h` : undefined} color="var(--color-accent)" />}
        {friend.weight_kg !== undefined && <Stat label="Weight" value={friend.weight_kg ? `${friend.weight_kg} kg` : 'No log'} />}
      </div>

      {friend.macros && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Protein" value={`${Math.round(friend.macros.protein)}g`} color="var(--color-move)" />
          <Stat label="Carbs" value={`${Math.round(friend.macros.carbs)}g`} color="var(--color-stand)" />
          <Stat label="Fat" value={`${Math.round(friend.macros.fat)}g`} color="var(--color-warn)" />
        </div>
      )}

      {friend.foods && friend.foods.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Recent food</p>
          {friend.foods.map(food => (
            <div key={food.id} className="flex justify-between gap-3 text-sm text-gray-300">
              <span className="truncate">{food.name}</span>
              <span className="text-gray-500">{Math.round(food.calories)} cal</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function FriendsPage() {
  const today = useCurrentLocalDate()
  const qc = useQueryClient()
  const [query, setQuery] = useState('')

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then(r => r.data as {
      friends: Friendship[]
      incoming: Friendship[]
      outgoing: Friendship[]
    }),
  })

  const { data: activityData } = useQuery({
    queryKey: ['friends-activity', today],
    queryFn: () => api.get(`/friends/activity?date=${today}`).then(r => r.data as { friends: FriendSummary[] }),
  })

  const trimmedQuery = query.trim()
  const { data: searchData } = useQuery({
    queryKey: ['friends-search', trimmedQuery],
    queryFn: () => api.get(`/friends/search?q=${encodeURIComponent(trimmedQuery)}`).then(r => r.data as { results: SearchResult[] }),
    enabled: trimmedQuery.length >= 2,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['friends'] })
    qc.invalidateQueries({ queryKey: ['friends-activity'] })
    qc.invalidateQueries({ queryKey: ['friends-search'] })
  }

  const requestMut = useMutation({
    mutationFn: (userId: number) => api.post('/friends/request', { user_id: userId }),
    onSuccess: refresh,
  })
  const acceptMut = useMutation({
    mutationFn: (id: number) => api.post(`/friends/${id}/accept`),
    onSuccess: refresh,
  })
  const declineMut = useMutation({
    mutationFn: (id: number) => api.post(`/friends/${id}/decline`),
    onSuccess: refresh,
  })
  const removeMut = useMutation({
    mutationFn: (id: number) => api.delete(`/friends/${id}`),
    onSuccess: refresh,
  })
  const searchResults = searchData?.results || []
  const friends = activityData?.friends || []
  const pendingCount = useMemo(
    () => (friendsData?.incoming.length || 0) + (friendsData?.outgoing.length || 0),
    [friendsData],
  )

  if (isLoading) return <Spinner />

  return (
    <div className="max-w-3xl mx-auto min-w-0 space-y-4">
      <div className="space-y-1">
        <p className="text-[13px] font-semibold uppercase text-gray-500">Shared daily logs</p>
        <h1 className="text-[32px] sm:text-4xl font-semibold leading-none tracking-tight">Friends</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-lime text-black flex items-center justify-center shrink-0">
            <Search size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="friend-search" className="sr-only">Search friends</label>
              <input
              id="friend-search"
              type="text"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search username or email"
            />
          </div>
        </div>

        {trimmedQuery.length >= 2 && (
          <div className="space-y-2">
            {searchResults.length === 0 && <p className="text-sm text-gray-500 px-1">No matching users.</p>}
            {searchResults.map(result => (
              <div key={result.user.id} className="flex items-center justify-between gap-3 rounded-2xl bg-elevated/70 px-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{result.user.profile_name}</p>
                  <p className="text-sm text-gray-500 truncate">@{result.user.username}</p>
                </div>
                {result.relation ? (
                  <span className="text-xs font-semibold text-gray-400 capitalize">{result.relation.status}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestMut.mutate(result.user.id)}
                    className="min-h-11 min-w-11 rounded-full bg-lime text-black flex items-center justify-center"
                    aria-label={`Add ${result.user.profile_name}`}
                  >
                    <UserPlus size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {pendingCount > 0 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Requests</h2>
          {friendsData?.incoming.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-elevated/70 px-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{item.user.profile_name}</p>
                <p className="text-sm text-gray-500 truncate">Sent you a request</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => declineMut.mutate(item.id)} className="min-h-11 min-w-11 rounded-full bg-surface text-gray-300 flex items-center justify-center" aria-label="Decline request">
                  <X size={17} />
                </button>
                <button type="button" onClick={() => acceptMut.mutate(item.id)} className="min-h-11 min-w-11 rounded-full bg-lime text-black flex items-center justify-center" aria-label="Accept request">
                  <Check size={17} />
                </button>
              </div>
            </div>
          ))}
          {friendsData?.outgoing.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-elevated/70 px-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{item.user.profile_name}</p>
                <p className="text-sm text-gray-500 truncate">Request sent</p>
              </div>
              <button type="button" onClick={() => removeMut.mutate(item.id)} className="min-h-11 min-w-11 rounded-full bg-surface text-gray-300 flex items-center justify-center" aria-label="Cancel request">
                <X size={17} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Users size={19} className="text-lime" />
          <h2 className="text-xl font-semibold tracking-tight">Today</h2>
        </div>
        {friends.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="text-lg font-semibold">No friends yet</p>
            <p className="mt-1 text-sm text-gray-500">Search for a user to share selected daily totals.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {friends.map(friend => (
              <FriendCard key={friend.friendship_id} friend={friend} onRemove={id => removeMut.mutate(id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
