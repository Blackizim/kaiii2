import React from 'react';

interface KairouLogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const KairouLogo: React.FC<KairouLogoProps> = ({
  className = '',
  showWordmark = false,
  size = 'md',
}) => {
  const boxClass =
    size === 'lg'
      ? 'w-14 h-14'
      : size === 'xs'
        ? 'w-[18px] h-[18px]'
        : size === 'sm'
        ? 'w-7 h-7'
        : 'w-9 h-9';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`${boxClass} overflow-hidden flex items-center justify-center shrink-0`}
      >
        <img
          src="/logo.svg"
          alt="Kairou"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
        />
      </span>
      {showWordmark && (
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Kairou
        </span>
      )}
    </span>
  );
};
