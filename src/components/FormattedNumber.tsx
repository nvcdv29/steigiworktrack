import React from 'react';

interface FormattedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string; 
  decimalClassName?: string;
  suffixClassName?: string;
}

export const FormattedNumber: React.FC<FormattedNumberProps> = ({
  value,
  suffix = '',
  prefix = '',
  decimals = 2,
  className = '',
  decimalClassName = 'text-[0.7em] opacity-60 font-medium',
  suffixClassName = 'text-[0.6em] opacity-50 font-normal ml-[2px]',
}) => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const parts = parseFloat(absValue.toFixed(decimals)).toString().split('.');
  const intStr = parts[0];
  const decStr = parts[1];

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      {isNegative ? '-' : ''}{prefix && prefix !== '-' ? prefix : ''}
      <span>{intStr}</span>
      {decStr && (
        <span className={decimalClassName}>.{decStr}</span>
      )}
      {suffix && (
        <span className={suffixClassName}>{suffix}</span>
      )}
    </span>
  );
};
