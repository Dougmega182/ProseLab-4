// src/components/LoreAgent/TimelineView.jsx

import React, { useState, useEffect } from 'react';

export default function TimelineView({ agent, onSelectEntity }) {
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [entities, setEntities] = useState([]);

  useEffect(() => {
    if (!agent) return;

    const updateData = () => {
      setEvents(agent.getTimeline());
      setEntities([...agent.store.entities]);
    };

    updateData();
    return agent.store.subscribe(updateData);
  }, [agent]);

  if (events.length === 0) {
    return (
      <div className="timeline-view empty-state">
        <p>No events tracked yet. Process text containing events to build a timeline.</p>
      </div>
    );
  }

  // Sort events by temporal order if available, otherwise by extraction order
  const sortedEvents = [...events].sort((a, b) => {
    if (a.temporalOrder !== undefined && b.temporalOrder !== undefined) {
      return a.temporalOrder - b.temporalOrder;
    }
    if (a.attributes?.date && b.attributes?.date) {
      return String(a.attributes.date).localeCompare(String(b.attributes.date));
    }
    return (a.firstSeen || 0) - (b.firstSeen || 0);
  });

  return (
    <div className="timeline-view">
      <div className="timeline-line" />
      {sortedEvents.map((event, index) => {
        const isExpanded = expandedEvent === event.id;
        
        // Participants are linked via relationships in buildTimeline, 
        // but here the user's snippet expected them in attributes.participants.
        // My buildTimeline in graphBuilder.js adds a .participants array to each event object.
        const participants = event.participants || [];
        const locations = event.locations || [];

        return (
          <div
            key={event.id}
            className={`timeline-event ${isExpanded ? 'expanded' : ''}`}
            onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
          >
            <div className="timeline-marker">
              <div className="marker-dot" style={{ backgroundColor: getTypeColor('event') }} />
              <div className="marker-index">{index + 1}</div>
            </div>

            <div className="timeline-content">
              <div className="event-header">
                <span className="event-name">{event.name}</span>
                {event.date && (
                  <span className="event-date">{event.date}</span>
                )}
                <span className="event-confidence">
                  {(event.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {event.description && (
                <div className="event-description">
                  {event.description}
                </div>
              )}

              {isExpanded && (
                <div className="event-details">
                  {participants.length > 0 && (
                    <div className="event-participants">
                      <span className="detail-label">Participants:</span>
                      {participants.map(p => (
                        <span
                          key={p.id}
                          className="entity-chip clickable"
                          style={{ borderColor: getTypeColor(p.type) }}
                          onClick={e => { 
                            e.stopPropagation(); 
                            if (onSelectEntity) onSelectEntity(p); 
                          }}
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {locations.length > 0 && (
                    <div className="event-location">
                      <span className="detail-label">Locations:</span>
                      {locations.map(loc => (
                        <span
                          key={loc.id}
                          className="entity-chip clickable"
                          style={{ borderColor: getTypeColor('location') }}
                          onClick={e => { 
                            e.stopPropagation(); 
                            if (onSelectEntity) onSelectEntity(loc); 
                          }}
                        >
                          {loc.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {event.contexts && event.contexts.length > 0 && (
                    <div className="event-contexts">
                      <span className="detail-label">Context:</span>
                      {event.contexts.slice(-2).map((ctx, i) => (
                        <div key={i} className="context-snippet">"{ctx}"</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTypeColor(type) {
  const colors = {
    character: '#4A90D9',
    location: '#2ECC71',
    item: '#E67E22',
    event: '#9B59B6',
    faction: '#E74C3C',
    concept: '#1ABC9C',
    creature: '#F39C12',
    unknown: '#95A5A6',
  };
  return colors[type] || colors.unknown;
}
