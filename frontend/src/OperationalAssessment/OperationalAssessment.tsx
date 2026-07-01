import { useState } from 'react'
import OverviewTab from './OverviewTab'
import TimelineTab from './TimelineTab'

type AssessmentTab = 'overview' | 'timeline'

export default function OperationalAssessment() {
  const [tab, setTab] = useState<AssessmentTab>('overview')

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-shrink-0 flex items-center justify-between mb-1 pb-1"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-3xs font-semibold tracking-wider text-muted uppercase">
          Operational Assessment
        </span>
      </div>

      <div className="flex-shrink-0 flex mb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setTab('overview')}
          className={`flex-1 py-1.5 text-3xs font-semibold uppercase tracking-wider transition-colors ${
            tab === 'overview'
              ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
              : 'text-muted hover:text-text'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab('timeline')}
          className={`flex-1 py-1.5 text-3xs font-semibold uppercase tracking-wider transition-colors ${
            tab === 'timeline'
              ? 'text-white border-b-2 border-white/40 bg-white/[0.03]'
              : 'text-muted hover:text-text'
          }`}
        >
          Timeline
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'overview' ? <OverviewTab /> : <TimelineTab />}
      </div>
    </div>
  )
}
