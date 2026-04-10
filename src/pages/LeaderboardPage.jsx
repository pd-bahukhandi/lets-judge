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
    // Fetch teams and scores separately to ensure team names are available
    const [{ data: teamsData }, { data: scoresData }] = await Promise.all([
      supabase.from('teams').select('id, name'),
      supabase.from('scores').select('team_id, total'),
    ])

    if (!teamsData) return

    // Build team name lookup
    const teamNames = {}
    for (const team of teamsData) {
      teamNames[team.id] = team.name
    }

    if (!profile) {
      // Unauthenticated: show all teams, no scores
      const allTeams = teamsData.map(team => ({
        name: team.name,
        id: team.id,
      }))
      setRows(allTeams)
    } else {
      // Authenticated: show only teams with scores, with full details
      if (!scoresData) return

      // Aggregate scores by team
      const map = {}
      for (const s of scoresData) {
        const id = s.team_id
        if (!map[id]) {
          map[id] = { name: teamNames[id] ?? 'Unknown', totals: [] }
        }
        map[id].totals.push(s.total)
      }

      const ranked = Object.values(map)
        .map(t => ({
          name: t.name,
          avg: t.totals.reduce((a, b) => a + b, 0) / t.totals.length,
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
        <h2>🏆 Leaderboard</h2>
        <div className="header-right">
          {profile ? (
            <>
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
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
              {!profile && <th>Status</th>}
              {profile && <th>Avg Score</th>}
              {profile && <th>Judges</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={profile ? row.name : row.id}
                className={profile && i < 3 ? `rank-${i + 1}` : ''}
              >
                <td className="rank-cell">
                  {profile ? (MEDALS[i] ?? i + 1) : (i + 1)}
                </td>
                <td className="team-name-cell">{row.name}</td>
                {!profile && <td className="status-cell">Participating</td>}
                {profile && (
                  <td className="score-cell">
                    <strong>{row.avg.toFixed(1)}</strong>
                    <span className="score-max"> / 100</span>
                  </td>
                )}
                {profile && <td>{row.judgeCount}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
