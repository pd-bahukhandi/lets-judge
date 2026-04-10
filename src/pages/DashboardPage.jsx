import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ScoreForm from '../components/ScoreForm'

export default function DashboardPage({ publicView = false }) {
  const { profile, logout } = useAuth()
  const [teams, setTeams] = useState([])
  const [scores, setScores] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (publicView || !profile) {
        // Public/read-only: fetch teams and aggregated scores
        const [{ data: teamsData }, { data: scoresData }] = await Promise.all([
          supabase.from('teams').select('*').order('name'),
          supabase.from('scores').select('team_id, total'),
        ])

        // Aggregate scores by team
        const map = {}
        for (const s of scoresData || []) {
          const id = s.team_id
          if (!map[id]) map[id] = { totals: [] }
          map[id].totals.push(s.total)
        }

        setTeams(teamsData || [])
        const byTeam = {}
        for (const t of teamsData || []) {
          const m = map[t.id]
          if (m) {
            const avg = m.totals.reduce((a, b) => a + b, 0) / m.totals.length
            byTeam[t.id] = { avg, judgeCount: m.totals.length }
          }
        }
        setScores(byTeam)
        setLoading(false)
      } else {
        // Authenticated judge: load teams and this judge's scores
        const [{ data: teamsData }, { data: scoresData }] = await Promise.all([
          supabase.from('teams').select('*').order('name'),
          supabase.from('scores').select('*').eq('judge_id', profile.id),
        ])
        setTeams(teamsData || [])
        const byTeam = {}
        for (const s of scoresData || []) byTeam[s.team_id] = s
        setScores(byTeam)
        setLoading(false)
      }
    }
    load()
  }, [profile, publicView])

  async function refreshScores() {
    if (publicView || !profile) return
    const { data } = await supabase
      .from('scores')
      .select('*')
      .eq('judge_id', profile.id)
    const byTeam = {}
    for (const s of data || []) byTeam[s.team_id] = s
    setScores(byTeam)
  }

  const scoredCount = Object.keys(scores).length

  if (loading) return <div className="loading">Loading teams…</div>

  return (
    <div className="page">
      <header className="app-header">
        <h2>{publicView ? 'Teams' : 'Judge Dashboard'}</h2>
        <div className="header-right">
          {profile ? (
            <>
              <span className="username-badge">👤 {profile.username}</span>
              <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
              {profile.role === 'admin' && (
                <Link to="/admin" className="nav-link">Admin</Link>
              )}
              <button onClick={logout} className="btn-logout">Log Out</button>
            </>
          ) : (
            <>
              <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
              <Link to="/login" className="nav-link">Log In</Link>
            </>
          )}
        </div>
      </header>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{ width: teams.length ? `${(scoredCount / teams.length) * 100}%` : '0%' }}
        />
      </div>
      <p className="progress-label">
        {scoredCount} / {teams.length} teams scored
      </p>

      <div className="teams-list">
        {teams.map(team => {
          const scored = !!scores[team.id]
          const isOpen = expanded === team.id
          return (
            <div key={team.id} className={`team-card ${scored ? 'scored' : ''} ${isOpen ? 'open' : ''}`}>
              <div className="team-header">
                <span className="team-name">{team.name}</span>
                <span className="team-status">
                  {publicView || !profile
                    ? scored
                      ? `Avg ${scores[team.id].avg.toFixed(1)} · ${scores[team.id].judgeCount} judges`
                      : 'No scores yet'
                    : scored
                      ? `✓ ${scores[team.id].total} / 100`
                      : 'Not scored yet'}
                </span>
              </div>
              {!publicView && (
                <>
                  <button
                    className="expand-toggle"
                    onClick={() => setExpanded(isOpen ? null : team.id)}
                  >
                    {isOpen ? '▲' : '▼'}
                  </button>
                  {isOpen && (
                    <ScoreForm
                      team={team}
                      existingScore={scores[team.id]}
                      onSaved={() => {
                        refreshScores()
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
