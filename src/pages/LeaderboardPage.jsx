import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const { profile, logout } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    // Fetch teams (including members + usecase) and scores separately
    const [{ data: teamsData }, { data: scoresData }] = await Promise.all([
      supabase.from('teams').select('id, name, members, usecase'),
      supabase.from('scores').select('team_id, total'),
    ])

    const scoredTeamIds = new Set(
      (scoresData ?? []).map(s => s.team_id)
    )

    const unscoredTeams = (teamsData ?? []).filter(
      team => !scoredTeamIds.has(team.id)
    )


    if (!teamsData) return

    // Build team lookup (name, members, usecase)
    const teamLookup = {}
    for (const team of teamsData) {
      teamLookup[team.id] = {
        id: team.id,
        name: team.name,
        members: team.members,
        usecase: team.usecase,
      }
    }

    if (!profile) {
      // Unauthenticated: show all teams, no scores
      const allTeams = teamsData.map(team => ({
        id: team.id,
        name: team.name,
        members: team.members,
        usecase: team.usecase,
      }))
      setRows(allTeams)
    } else {
      // Ensure scoresData is always usable
        const safeScores = scoresData ?? []

        // Aggregate scores by team
        const map = {}

        for (const s of safeScores) {
          const id = s.team_id
          if (!map[id]) {
            const team = teamLookup[id] ?? { name: 'Unknown', members: '', usecase: '' }
            map[id] = { id, name: team.name, members: team.members, usecase: team.usecase, totals: [] }
          }
          map[id].totals.push(s.total)
        }

        // Build ranked list (avg = 0 when no scores)
        const ranked = Object.values(map)
          .map(t => ({
            id: t.id,
            name: t.name,
            members: t.members,
            usecase: t.usecase,
            avg:
              t.totals.length > 0
                ? t.totals.reduce((a, b) => a + b, 0) / t.totals.length
                : 0,
            judgeCount: t.totals.length,
          }))
          .sort((a, b) => b.avg - a.avg)

        setRows(ranked)
    }

    setLastUpdated(new Date())
    setLoading(false)
  }, [profile])

  useEffect(() => {
    load()

    let channel = null
    if (profile) {
      // Only set up real-time updates for authenticated users
      channel = supabase
        .channel('leaderboard-scores')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'scores' },
          load
        )
        .subscribe()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [load, profile])

  return (
    <div className="page">
      <header className="app-header">
        <h2>{profile ? '🏆 Leaderboard' : "🚀 Let's Hack"}</h2>
        <div className="header-right">
          {profile ? (
            <>            
              {profile.role === 'judge' && (
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
              )}
              {profile.role === 'admin' && (
                <Link to="/admin" className="nav-link">Admin</Link>
              )}
              <button onClick={logout} className="btn-logout">Log Out</button>
            </>
          ) : (
            <Link to="/login" className="nav-link">Log In</Link>
          )}
        </div>
      </header>

      {profile && lastUpdated && (
        <p className="live-badge">
          ● Live · updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <p className="empty-state">{profile ? 'No scores submitted yet. Check back soon!' : 'No teams available.'}</p>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Members</th>
              <th>Usecase</th>
              {profile && profile.role === 'admin' && <th>Avg Score</th>}
              {profile && profile.role === 'admin' && <th>Judges</th>}              
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id ?? row.name}
                className={profile && i < 3 ? `rank-${i + 1}` : ''}
              >
                <td className="rank-cell">
                  {profile ? (MEDALS[i] ?? i + 1) : (i + 1)}
                </td>
                <td className="team-name-cell">{row.name}</td>
                <td className="status-cell">{row.members}</td>
                <td className="usecase-cell">{row.usecase}</td>
                {profile && profile.role === 'admin' && <td>{row.avg}</td>} 
                {profile && profile.role === 'admin' && <td>{row.judgeCount}</td>}                
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
