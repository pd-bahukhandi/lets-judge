import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CATS = [
  { key: 'ai_innovation',       label: 'AI',   max: 20 },
  { key: 'business_impact',     label: 'Biz',  max: 30 },
  { key: 'technical_execution', label: 'Tech', max: 30 },
  { key: 'usability',           label: 'UX',   max: 10 },
  { key: 'presentation',        label: 'Pres', max: 10 },
]

export default function AdminPage() {
  const { logout } = useAuth()
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [unscoredTeams, setUnscoredTeams] = useState([])

  useEffect(() => {
    async function load() {
      const [{ data: scoresData }, { data: teamsData }] = await Promise.all([
        supabase.from('scores').select('*, teams(name), profiles(username)').order('teams(name)'),
        supabase.from('teams').select('id, name'),
      ])

      setScores(scoresData || [])

      const scoredIds = new Set((scoresData || []).map(s => s.team_id))
      const unscored = (teamsData || []).filter(t => !scoredIds.has(t.id))
      setUnscoredTeams(unscored || [])

      setLoading(false)
    }
    load()
  }, [])

  // Group scores by team for per-team averages
  const teamAverages = {}
  for (const s of scores) {
    const name = s.teams?.name ?? 'Unknown'
    if (!teamAverages[name]) teamAverages[name] = []
    teamAverages[name].push(s.total)
  }

  return (
    <div className="page">
      <header className="app-header">
        <h2>Admin – All Scores</h2>
        <div className="header-right">          
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
          <button onClick={logout} className="btn-logout">Log Out</button>
        </div>
      </header>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div>
          {/* Team Averages on top */}
          <div className="averages-section" style={{ marginBottom: '3rem' }}>
            <h3>Team Averages</h3>
            <table className="averages-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold' }}>Team</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Average Score</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Judge Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(teamAverages).map(([name, totals]) => {
                  const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)
                  const judgeCount = totals.length
                  return (
                    <tr key={name} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '1rem', textAlign: 'left' }}><strong>{name}</strong></td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontSize: '1.1rem' }}><strong>{avg}</strong></td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>{judgeCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Unscored Teams in the middle */}
          {unscoredTeams.length > 0 && (
            <div className="unscored-section" style={{ marginBottom: '3rem' }}>
              <h3>Teams without scores</h3>
              <ul>
                {unscoredTeams.map(t => (
                  <li key={t.id}>{t.name}</li>
                ))} 
              </ul>
            </div>
          )}

          {/* Detailed scores at the bottom */}
          <div className="table-scroll" style={{ marginTop: '2rem' }}>
            <h3>All Scores</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Judge</th>
                  {CATS.map(c => (
                    <th key={c.key} title={c.key}>
                      {c.label}<span className="max-label">/{c.max}</span>
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {scores.map(s => (
                  <tr key={s.id}>
                    <td className="team-col">{s.teams?.name}</td>
                    <td className="judge-col">{s.profiles?.username}</td>
                    {CATS.map(c => (
                      <td key={c.key} className="score-col">{s[c.key]}</td>
                    ))}
                    <td className="total-col"><strong>{s.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
