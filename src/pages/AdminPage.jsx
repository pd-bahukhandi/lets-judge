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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('scores')
        .select('*, teams(name), profiles(username)')
        .order('teams(name)')
      setScores(data || [])
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
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
          <button onClick={logout} className="btn-logout">Log Out</button>
        </div>
      </header>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="table-scroll">
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
            <tfoot>
              {Object.entries(teamAverages).map(([name, totals]) => {
                const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)
                const judgeCount = totals.length
                return (
                  <tr key={name} className="avg-row">
                    <td colSpan={2}><strong>{name}</strong> avg</td>
                    {CATS.map(c => <td key={c.key} />)}
                    <td><strong>{avg}</strong>
                    <span className="judge-count">({judgeCount})</span>
                    </td>
                  </tr>
                )
              })}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
