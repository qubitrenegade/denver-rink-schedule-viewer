import React from 'react';
import { DisplayableIceEvent } from '../types';
import EventCard from './EventCard';

interface EventListProps {
  events: DisplayableIceEvent[];
}

// Group and render events by date
const EventList: React.FC<EventListProps> = ({ events }) => {
  // Group events by date string (e.g., 'Mon May 30 2025')
  const groupedEvents: Record<string, DisplayableIceEvent[]> = events.reduce((acc, event) => {
    const dateKey = new Date(event.startTime).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, DisplayableIceEvent[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedEvents).map(([dateKey, dailyEvents]) => (
        <div key={dateKey}>
          <h3 className="text-xl font-semibold text-sky-300 mb-4 pb-2 border-b border-slate-700">
            {/* Format date for display */}
            {new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <div className="space-y-4">
            {dailyEvents.map((event, index) => (
              <EventCard 
                key={`${event.id}-${event.rinkId}-${event.startTime}-${index}`} 
                event={event} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventList;
