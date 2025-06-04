import React from 'react';
import { DisplayableIceEvent, EventCategory } from '../types';
import { ClockIcon, TagIcon, InfoIcon, StarIcon, GlobeAltIcon, LinkIcon, MapPinIcon } from './icons'; 

interface EventCardProps {
  event: DisplayableIceEvent;
}

// Format event time for display
const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// Get color classes for event category
const getCategoryColor = (category: EventCategory): string => {
  switch (category) {
    case 'Public Skate': return 'bg-blue-600 text-blue-100';
    case 'Stick & Puck': return 'bg-green-600 text-green-100';
    case 'Hockey League': return 'bg-red-600 text-red-100';
    case 'Learn to Skate': return 'bg-yellow-500 text-yellow-900'; 
    case 'Figure Skating': return 'bg-purple-600 text-purple-100';
    case 'Hockey Practice': return 'bg-orange-600 text-orange-100';
    case 'Drop-In Hockey': return 'bg-teal-600 text-teal-100';
    case 'Special Event': return 'bg-pink-600 text-pink-100';
    default: return 'bg-gray-600 text-gray-100';
  }
};

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  // Compute event duration in minutes
  const startTimeDate = new Date(event.startTime);
  const endTimeDate = new Date(event.endTime);
  const duration = (endTimeDate.getTime() - startTimeDate.getTime()) / (1000 * 60); // Duration in minutes

  return (
    <div 
      className={`
        bg-slate-700/70 shadow-lg rounded-lg p-4 sm:p-5 
        border-l-4 transition-all hover:shadow-xl hover:scale-[1.01]
        ${event.isFeatured ? 'border-yellow-400 bg-slate-700' : 'border-sky-500'}
      `}
      aria-labelledby={`event-title-${event.id}`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 sm:mb-3">
        <div className="flex items-center gap-2 mb-1 sm:mb-0">
          <h4 id={`event-title-${event.id}`} className="text-lg sm:text-xl font-semibold text-sky-200">
            {event.title}
          </h4>
          {event.eventUrl && (
            <a 
              href={event.eventUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 transition-colors"
              title="View event details"
            >
              <LinkIcon className="w-4 h-4" />
            </a>
          )}
        </div>
        {event.isFeatured && (
          <div className="flex items-center text-xs font-medium bg-yellow-400/20 text-yellow-300 px-2.5 py-1 rounded-full self-start sm:self-center">
            <StarIcon className="w-3.5 h-3.5 mr-1.5" />
            FEATURED
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-300 mb-3">
        <div className="flex items-center" title="Time">
          <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-sky-400 shrink-0" />
          <span>{formatTime(event.startTime)} - {formatTime(event.endTime)} ({duration} min)</span>
        </div>
        <div className="flex items-center" title="Category">
          <TagIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-sky-400 shrink-0" />
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getCategoryColor(event.category)}`}>
            {event.category}
          </span>
        </div>
        {event.facilityName && (
          <div className="flex items-center" title="Facility">
            <GlobeAltIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-sky-400 shrink-0" />
            <span className="text-sm text-slate-300">
              {event.facilityName}
            </span>
          </div>
        )}
        {event.rinkName && event.rinkName !== 'Main Rink' && (
          <div className="flex items-center" title="Rink">
            <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-sky-400 shrink-0" />
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-600 text-slate-200">
              {event.rinkName}
            </span>
          </div>
        )}
      </div>

      {event.description && (
        <div className="mt-2 flex items-start text-sm text-slate-400">
          <InfoIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0 mt-0.5 text-sky-400" />
          <p>{event.description}</p>
        </div>
      )}
    </div>
  );
};

export default EventCard;
