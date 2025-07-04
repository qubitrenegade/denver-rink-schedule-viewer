import React from 'react';

interface EnhancedTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}

const EnhancedTimeInput: React.FC<EnhancedTimeInputProps> = ({ 
  value, 
  onChange, 
  className = '', 
  placeholder,
  id
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
      id={id}
      type="time"
      step="900"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={(e) => {
        // Help with typing shortcuts like "0900" or "2100" when user finishes typing
        const input = e.currentTarget;
        const inputValue = input.value;
        
        // If it looks like they typed a 4-digit time without colon
        if (inputValue.match(/^\d{3,4}$/)) {
          let hours, minutes;
          if (inputValue.length === 3) {
            // "900" -> "09:00"  
            hours = inputValue.slice(0, 1).padStart(2, '0');
            minutes = inputValue.slice(1);
          } else {
            // "0900" -> "09:00"
            hours = inputValue.slice(0, 2);
            minutes = inputValue.slice(2);
          }
          
          const formattedTime = `${hours}:${minutes}`;
          
          // Validate and set if it's a valid time
          const [h, m] = [parseInt(hours), parseInt(minutes)];
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            onChange(formattedTime);
          }
        }
      }}
      onWheel={(e) => {
        // Always use 15-minute increments for wheel - simple and consistent
        e.preventDefault();
        const newTime = handle15MinuteIncrement(e.currentTarget.value, e.deltaY > 0);
        onChange(newTime);
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default EnhancedTimeInput;