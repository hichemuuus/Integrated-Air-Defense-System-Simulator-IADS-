import SystemStatus from './SystemStatus'
import TrackList from './TrackList'
import ThreatLog from './ThreatLog'
import InterceptStatus from './InterceptStatus'
import EventFeed from './EventFeed'
import type { TrackFilter } from '../App'

interface Props {
  trackFilter: TrackFilter
  onFilterChange: (filter: TrackFilter) => void
}

export default function Sidebar({ trackFilter, onFilterChange }: Props) {
  return (
    <div className="flex flex-col h-full gap-px p-1.5 bg-bg" style={{ minWidth: 0 }}>
      <SystemStatus />
      <div className="flex-1 flex flex-col gap-px" style={{ minHeight: 0 }}>
        <div className="flex-[1.2]" style={{ minHeight: 0 }}>
          <TrackList filter={trackFilter} onFilterChange={onFilterChange} />
        </div>
        <div className="flex-[0.9]" style={{ minHeight: 0 }}>
          <ThreatLog />
        </div>
        <div className="flex-[0.9]" style={{ minHeight: 0 }}>
          <InterceptStatus />
        </div>
        <div className="flex-[0.8]" style={{ minHeight: 0 }}>
          <EventFeed />
        </div>
      </div>
    </div>
  )
}
