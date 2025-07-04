import React from 'react';

interface TimeInputProps {
  value: string; // Format: "HH:MM"
  onChange: (time: string) => void;
  className?: string;
  id?: string;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, className = '', id }) => {
  const [hours, minutes] = value.split(':');
  
  // Generate hour options (6 AM to 11 PM, common rink hours)
  const hourOptions = [];
  for (let i = 6; i <= 23; i++) {
    const hour = i.toString().padStart(2, '0');
    const display = i <= 12 ? `${i}:00 AM` : `${i - 12}:00 PM`;
    if (i === 12) {
      hourOptions.push({ value: hour, label: '12:00 PM' });
    } else {
      hourOptions.push({ value: hour, label: display });
    }
  }
  
  // Generate minute options (every 15 minutes)
  const minuteOptions = [
    { value: '00', label: ':00' },
    { value: '15', label: ':15' },
    { value: '30', label: ':30' },
    { value: '45', label: ':45' }
  ];
  
  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minutes}`);
  };
  
  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hours}:${newMinute}`);
  };
  
  return (
    <div className={className}>
      {/* Desktop: Show dropdowns */}
      <div className="hidden sm:flex space-x-2">
        <div className="flex-1">
          <select
            id={id}
            value={hours}
            onChange={e => handleHourChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm"
          >
            {hourOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <select
            value={minutes}
            onChange={e => handleMinuteChange(e.target.value)}
            className="w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400 text-sm"
          >
            {minuteOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Mobile: Show native time input for better UX */}
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="sm:hidden w-full px-3 py-2 bg-slate-600 border border-slate-500 text-slate-200 rounded-md focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
      />
    </div>
  );
};

export default TimeInput;