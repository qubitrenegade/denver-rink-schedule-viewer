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
      className={className}
      placeholder={placeholder}
    />
  );
};

export default EnhancedTimeInput;