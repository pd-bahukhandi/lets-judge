import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = [
  { key: 'ai_innovation',       label: 'AI Innovation & Creativity', max: 20 },
  { key: 'business_impact',     label: 'Business Impact',            max: 30 },
  { key: 'technical_execution', label: 'Technical Execution',        max: 30 },
  { key: 'usability',           label: 'Usability',                  max: 10 },
  { key: 'presentation',        label: 'Presentation & Demo',        max: 10 },
]

function emptyValues() {
  return Object.fromEntries(CATEGORIES.map(c => [c.key, '']))
}

export default function ScoreForm({ team, existingScore, onSaved }) {
  const { profile } = useAuth()
  const [values, setValues] = useState(
    existingScore
      ? Object.fromEntries(CATEGORIES.map(c => [c.key, existingScore[c.key] ?? '']))
      : emptyValues()
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!existingScore)
  const [error, setError] = useState(null)

  function handleChange(key, val, max) {
    let n = val === '' ? '' : parseInt(val, 10)
    if (n !== '' && !isNaN(n)) n = Math.max(0, Math.min(n, max))
    setValues(prev => ({ ...prev, [key]: n }))
    setSaved(false)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    for (const c of CATEGORIES) {
      const v = values[c.key]
      if (v === '' || v === null || v === undefined) {
        setError(`Please fill in "${c.label}"`)
        return
      }
    }

    setSaving(true)
    const row = {
      judge_id: profile.id,
      team_id: team.id,
      ...Object.fromEntries(CATEGORIES.map(c => [c.key, Number(values[c.key])])),
      updated_at: new Date().toISOString(),
    }

    const { error: err } = await supabase
      .from('scores')
      .upsert(row, { onConflict: 'judge_id,team_id' })

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      onSaved?.()
    }
  }

  const total = CATEGORIES.reduce((sum, c) => sum + (Number(values[c.key]) || 0), 0)

  return (
    <form className="score-form" onSubmit={handleSubmit}>
      {CATEGORIES.map(c => (
        <div key={c.key} className="score-field">
          <label htmlFor={`${team.id}-${c.key}`}>
            {c.label}
            <span className="max-label">/ {c.max}</span>
          </label>
          <input
            id={`${team.id}-${c.key}`}
            type="number"
            min={0}
            max={c.max}
            value={values[c.key]}
            onChange={e => handleChange(c.key, e.target.value, c.max)}
            required
          />
        </div>
      ))}
      <div className="score-total">
        Total: <strong>{total}</strong> / 100
      </div>
      {error && <p className="form-error">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className={`btn-save ${saved ? 'saved' : ''}`}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Scores'}
      </button>
    </form>
  )
}
