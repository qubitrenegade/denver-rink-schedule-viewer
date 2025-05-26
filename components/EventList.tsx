
import React from 'react';
import { DisplayableIceEvent } from '../types';
import EventCard from './EventCard';

interface EventListProps {
  events: DisplayableIceEvent[];
}

const EventList: React.FC<EventListProps> = ({ events }) => {
  // Group events by date
  const groupedEvents: Record<string, DisplayableIceEvent[]> = events.reduce((acc, event) => {
    const dateKey = new Date(event.startTime).toDateString(); // Parse string to Date for grouping
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, DisplayableIceEvent[]>);


  return (
    <div className="space-y-8">
      {Object.entries(groupedEvents).map(([dateKey, dailyEvents]) => (
        <div key={dateKey}>
          <h3 className="text-xl font-semibold text-sky-300 mb-4 pb-2 border-b border-slate-700">
            {/* dateKey is already a string from toDateString(), so new Date(dateKey) is correct for formatting */}
            {new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <div className="space-y-4">
            {dailyEvents.map((event) => (
              <EventCard key={event.id + (event.rinkName || '')} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventList;
