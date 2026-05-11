import React, { useRef, useEffect } from 'react';

interface PostcodeInputProps {
  format: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  countryCode?: string;
}

export const PostcodeInput: React.FC<PostcodeInputProps> = ({ format, value, onChange, className, countryCode }) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Parse format to determine input structure
  // N: Digit, A: Alphabet, ?: Any, others: static characters
  const structure = format.split('').map((char, index) => {
    if (char === 'N') return { type: 'digit', index };
    if (char === 'A') return { type: 'alpha', index };
    if (char === '?') return { type: 'any', index };
    return { type: 'static', char, index };
  });

  const editableFields = structure.filter(s => s.type !== 'static');
  const values = value.split('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, fieldIndex: number) => {
    const char = e.target.value.slice(-1).toUpperCase();
    if (!char) return;

    const field = editableFields[fieldIndex];
    if (field.type === 'digit' && !/\d/.test(char)) return;
    if (field.type === 'alpha' && !/[A-Z]/.test(char)) return;

    const newValues = [...values];
    // Ensure array is long enough
    while (newValues.length <= field.index) newValues.push(' ');
    
    newValues[field.index] = char;
    
    // Fill in static characters if they are missing
    structure.forEach(s => {
      if (s.type === 'static') {
        newValues[s.index] = s.char;
      }
    });

    onChange(newValues.join('').trim());

    // Focus next field
    if (fieldIndex < editableFields.length - 1) {
      inputRefs.current[fieldIndex + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fieldIndex: number) => {
    if (e.key === 'Backspace') {
      const newValues = [...values];
      const field = editableFields[fieldIndex];
      
      if (!newValues[field.index] || newValues[field.index] === ' ') {
        // Focus previous field
        if (fieldIndex > 0) {
          inputRefs.current[fieldIndex - 1]?.focus();
        }
      } else {
        newValues[field.index] = ' ';
        onChange(newValues.join('').trim());
      }
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {countryCode && (
        <div className="mr-2 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-1 px-1.5 shadow-sm">
          <img 
            src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`} 
            alt={countryCode}
            className="w-5 h-auto rounded-md shadow-sm"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      {structure.map((s, i) => {
        if (s.type === 'static') {
          return <span key={i} className="text-gray-500 font-mono">{s.char}</span>;
        }

        const fieldIndex = editableFields.indexOf(s);
        return (
          <input
            key={i}
            ref={el => { if (el) inputRefs.current[fieldIndex] = el; }}
            type="text"
            value={values[s.index] || ''}
            onChange={e => handleChange(e, fieldIndex)}
            onKeyDown={e => handleKeyDown(e, fieldIndex)}
            className="w-8 h-10 text-center border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono uppercase"
            maxLength={1}
          />
        );
      })}
    </div>
  );
};
