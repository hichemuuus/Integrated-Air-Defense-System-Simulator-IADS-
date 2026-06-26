import { useSimStore, POLICIES } from '../store/simulationStore'
import type { PolicyId } from '../types'

interface Props {
  onControl: (action: string, payload?: any) => void
}

export default function PolicySelector({ onControl }: Props) {
  const activePolicy = useSimStore(s => s.activePolicy)
  const setActivePolicy = useSimStore(s => s.setActivePolicy)
  const addToast = useSimStore(s => s.addToast)

  const handlePolicyChange = (id: PolicyId, name: string) => {
    if (id === activePolicy) return
    setActivePolicy(id)
    onControl('set_policy', { policy_name: id })
    addToast({ message: `Policy changed to ${name}`, type: 'info' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header mb-3">Active Policy</div>

      <div className="flex-1 overflow-y-auto space-y-1.5 custom-scroll">
        {POLICIES.map(p => {
          const isActive = activePolicy === p.id
          return (
            <button
              key={p.id}
              onClick={() => handlePolicyChange(p.id, p.name)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '2px',
                border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.06)',
                background: isActive ? 'rgba(59,130,246,0.04)' : 'transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isActive) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { if (!isActive) (e.target as HTMLElement).style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-2xs font-semibold tracking-wider uppercase" style={{
                  color: isActive ? '#3B82F6' : '#E2E8F0',
                }}>
                  {p.name}
                  {isActive && <span style={{ marginLeft: '0.375rem', color: '#3B82F6', opacity: 0.5 }}>◀</span>}
                </span>
                <span className="text-3xs text-muted font-mono">
                  Ø {p.avgScore}
                </span>
              </div>
              <p className="text-3xs text-dim leading-snug" style={{ margin: 0 }}>{p.description}</p>
            </button>
          )
        })}
      </div>

      <div style={{
        flexShrink: 0,
        marginTop: '0.5rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
        fontSize: '0.5rem',
        color: '#4A5568',
      }}>
        Click a policy to activate. Reset required.
      </div>
    </div>
  )
}
