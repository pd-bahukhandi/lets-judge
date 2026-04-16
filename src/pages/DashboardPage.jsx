import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ScoreForm from '../components/ScoreForm'

export default function DashboardPage() {
  const { profile, logout } = useAuth()
  const [teams, setTeams] = useState([])
  const [scores, setScores] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return // Wait for profile to load
    async function load() {
      const [{ data: teamsData }, { data: scoresData }] = await Promise.all([
        supabase.from('teams').select('id, name, members, usecase').order('name'),
        supabase.from('scores').select('*').eq('judge_id', profile.id),
      ])
      setTeams(teamsData || [])
      const byTeam = {}
      for (const s of scoresData || []) byTeam[s.team_id] = s
      setScores(byTeam)
      setLoading(false)
    }
    load()
  }, [profile])

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
        <h2>{profile.username}'s Dashboard</h2>
        <div className="header-right">
          <span className="username-badge">👤 {profile.username}</span>
          <button onClick={logout} className="btn-logout">Log Out</button>
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
              <button
                className="team-header"
                onClick={() => setExpanded(isOpen ? null : team.id)}
              >
                <span className="team-name">{team.name}</span>
                <span className="team-status">
                  {scored ? `✓ ${scores[team.id].total} / 100` : 'Not scored yet'}
                </span>
                <span className="expand-icon">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <>
                  <div className="team-details" style={{ marginBottom: '2rem' }}>
                    <div className="detail-section" style={{ marginBottom: '1rem' }}>
                      <h4>Members</h4>
                      <p>{team.members || 'N/A'}</p>
                    </div>
                    <div className="detail-section">
                      <h4>Usecase</h4>
                      <p>{team.usecase || 'N/A'}</p>
                    </div>
                  </div>
                  <ScoreForm
                    team={team}
                    existingScore={scores[team.id]}
                    onSaved={() => {
                      refreshScores()
                    }}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
