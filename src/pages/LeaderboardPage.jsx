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

    if (!teamsData || !scoresData) return

    // Build team name lookup
    const teamNames = {}
    for (const team of teamsData) {
      teamNames[team.id] = team.name
    }

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
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('leaderboard-scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [load])

  return (
    <div className="page">
      <header className="app-header">
        <h2>🏆 Leaderboard</h2>
        <div className="header-right">
          <Link to={profile ? "/dashboard" : "/teams"} className="nav-link">
            {profile ? 'Dashboard' : 'Teams'}
          </Link>
          {profile?.role === 'admin' && (
            <Link to="/admin" className="nav-link">Admin</Link>
          )}
          <button onClick={logout} className="btn-logout">Log Out</button>
        </div>
      </header>

      {lastUpdated && (
        <p className="live-badge">
          ● Live · updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <p className="empty-state">No scores submitted yet. Check back soon!</p>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Avg Score</th>
              <th>Judges</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.name}
                className={i < 3 ? `rank-${i + 1}` : ''}
              >
                <td className="rank-cell">
                  {MEDALS[i] ?? i + 1}
                </td>
                <td className="team-name-cell">{row.name}</td>
                <td className="score-cell">
                  <strong>{row.avg.toFixed(1)}</strong>
                  <span className="score-max"> / 100</span>
                </td>
                <td>{row.judgeCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
