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
      onInput={(e) => {
        // Help with typing shortcuts like "0900" or "2100"
        const input = e.currentTarget;
        const inputValue = input.value;
        
        // If user typed a 4-digit time, try to format it
        if (inputValue.match(/^\d{4}$/)) {
          const hours = inputValue.slice(0, 2);
          const minutes = inputValue.slice(2);
          const formattedTime = `${hours}:${minutes}`;
          
          // Validate and set if it's a valid time
          const [h, m] = [parseInt(hours), parseInt(minutes)];
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            onChange(formattedTime);
            // Clear the input to prevent weird states
            setTimeout(() => {
              input.value = formattedTime;
            }, 0);
          }
        }
      }}
      onWheel={(e) => {
        // Only intercept wheel events when the entire input is selected
        // or when we can't determine cursor position (let native handle hour/AM-PM scrolling)
        const input = e.currentTarget;
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        
        // If entire input is selected or we're in the minutes part, use 15-min increments
        const isEntirelySelected = selectionStart === 0 && selectionEnd === input.value.length;
        const isInMinutes = selectionStart !== null && selectionStart >= 3; // After "HH:"
        
        if (isEntirelySelected || isInMinutes) {
          e.preventDefault();
          const newTime = handle15MinuteIncrement(e.currentTarget.value, e.deltaY > 0);
          onChange(newTime);
        }
        // Otherwise, let native behavior handle hours/AM-PM scrolling
      }}
      onKeyDown={(e) => {
        // Only intercept arrow keys when in minutes section or entire input selected
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const input = e.currentTarget;
          const selectionStart = input.selectionStart;
          const selectionEnd = input.selectionEnd;
          
          const isEntirelySelected = selectionStart === 0 && selectionEnd === input.value.length;
          const isInMinutes = selectionStart !== null && selectionStart >= 3; // After "HH:"
          
          if (isEntirelySelected || isInMinutes) {
            e.preventDefault();
            const newTime = handle15MinuteIncrement(e.currentTarget.value, e.key === 'ArrowUp');
            onChange(newTime);
          }
          // Otherwise, let native behavior handle hours/AM-PM
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default EnhancedTimeInput;