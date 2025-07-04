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
      onBlur={(e) => {
        // Help with typing shortcuts like "0900" or "2100" when user finishes typing
        const input = e.currentTarget;
        const inputValue = input.value;
        
        console.log('Blur event, input value:', inputValue);
        
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
          console.log('Trying to format:', inputValue, '->', formattedTime);
          
          // Validate and set if it's a valid time
          const [h, m] = [parseInt(hours), parseInt(minutes)];
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            console.log('Valid time, setting:', formattedTime);
            onChange(formattedTime);
          }
        }
      }}
      onWheel={(e) => {
        // Let me add some debugging and simplify the logic
        const input = e.currentTarget;
        const selectionStart = input.selectionStart;
        
        console.log('Wheel event - cursor position:', selectionStart, 'value:', input.value);
        
        // Only intercept when cursor is in minutes (position 3-5 for "HH:MM")
        if (selectionStart !== null && selectionStart >= 3) {
          console.log('Intercepting wheel for minutes');
          e.preventDefault();
          const newTime = handle15MinuteIncrement(e.currentTarget.value, e.deltaY > 0);
          onChange(newTime);
        } else {
          console.log('Letting native handle wheel for hours/AM-PM');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const input = e.currentTarget;
          const selectionStart = input.selectionStart;
          
          console.log('Arrow key - cursor position:', selectionStart, 'value:', input.value);
          
          // Only intercept when cursor is in minutes
          if (selectionStart !== null && selectionStart >= 3) {
            console.log('Intercepting arrow for minutes');
            e.preventDefault();
            const newTime = handle15MinuteIncrement(e.currentTarget.value, e.key === 'ArrowUp');
            onChange(newTime);
          } else {
            console.log('Letting native handle arrow for hours/AM-PM');
          }
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default EnhancedTimeInput;