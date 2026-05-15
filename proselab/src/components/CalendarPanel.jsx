import React from 'react';

const CALENDAR_EVENTS = [
  {
    id: 1,
    title: "⚽JDP Soccer GAME DAY",
    time: "7:00 am",
    date: "Sun, 10 May",
    type: "sport",
    status: "done"
  },
  {
    id: 2,
    title: "Free Credits Galaxy.ai",
    time: "10:00 am",
    date: "Sun, 10 May",
    type: "tech",
    status: "active"
  },
  {
    id: 3,
    title: "SamsungDex D2",
    time: "12:00 pm",
    date: "Sun, 10 May",
    type: "work",
    status: "upcoming"
  }
];

export default function CalendarPanel() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="calendar-panel">
      <div className="calendar-header">
        <div>
          <div className="calendar-kicker">Family-Only View</div>
          <div className="calendar-title">Psaila Kids Calendar</div>
          <div className="calendar-filter-notice">
            <span className="dot warning"></span>
            Excluding: dalepsaila@gmail.com
          </div>
        </div>
        <div className="calendar-today-badge">
          {dateStr}
        </div>
      </div>

      <div className="calendar-grid">
        <div className="calendar-events-column">
          <div className="panel-header">
            <span className="panel-title">Today's Timeline</span>
            <span className="panel-badge live">{CALENDAR_EVENTS.length} Events</span>
          </div>
          
          <div className="event-list">
            {CALENDAR_EVENTS.map(event => (
              <div key={event.id} className={`event-card is-${event.status}`}>
                <div className="event-time">{event.time}</div>
                <div className="event-content">
                  <div className="event-title">{event.title}</div>
                  <div className="event-meta">{event.date}</div>
                </div>
                <div className="event-status-pill">{event.status.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-side-column">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Writing Availability</span>
            </div>
            <div className="availability-stats">
              <div className="stat-row">
                <span>Free blocks</span>
                <strong>2</strong>
              </div>
              <div className="stat-row">
                <span>Next window</span>
                <strong>1:30 PM</strong>
              </div>
            </div>
            <div className="availability-meter">
              <div className="meter-label">Daily Capacity</div>
              <div className="meter-bar">
                <div className="meter-fill" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: '16px' }}>
            <div className="panel-header">
              <span className="panel-title">Sync Status</span>
            </div>
            <div className="sync-status">
              <div className="status-item">
                <div className="status-dot connected"></div>
                <span>Psaila Kids Calendar</span>
              </div>
              <div className="status-item disabled">
                <div className="status-dot muted"></div>
                <span style={{ textDecoration: 'line-through' }}>dalepsaila@gmail.com</span>
              </div>
              <div className="status-item">
                <div className="status-dot connected"></div>
                <span>FamilyWall Cloud</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
