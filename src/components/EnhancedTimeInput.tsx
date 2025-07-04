import React from 'react';

interface EnhancedTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const EnhancedTimeInput: React.FC<EnhancedTimeInputProps> = ({ 
  value, 
  onChange, 
  className = '', 
  placeholder 
}) => {
  const handle15MinuteIncrement = (currentTime: string, increment: boolean) => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    
    // Round to nearest 15-minute interval and adjust
    const roundedMinutes = Math.round(currentMinutes / 15) * 15;
    const newMinutes = increment ? roundedMinutes + 15 : roundedMinutes - 15;
    
    // Clamp to valid time range
    const clampedMinutes = Math.max(0, Math.min(24 * 60 - 15, newMinutes));
    const newHours = Math.floor(clampedMinutes / 60);
    const newMins = clampedMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  return (
    <input
      type="time"
      step="900"
      value={value}
      onChange={e => onChange(e.target.value)}
      onWheel={(e) => {
        e.preventDefault();
        const newTime = handle15MinuteIncrement(e.currentTarget.value, e.deltaY > 0);
        onChange(newTime);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const newTime = handle15MinuteIncrement(e.currentTarget.value, e.key === 'ArrowUp');
          onChange(newTime);
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default EnhancedTimeInput;