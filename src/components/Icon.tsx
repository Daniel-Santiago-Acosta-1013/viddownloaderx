import React from 'react';
import * as OutlineIcons from '@heroicons/react/24/outline';
import * as SolidIcons from '@heroicons/react/24/solid';

interface IconProps {
  name: string;
  solid?: boolean;
  className?: string;
  onClick?: () => void;
}

const Icon: React.FC<IconProps> = ({ name, solid = false, className = '', onClick }) => {
  const library = solid ? SolidIcons : OutlineIcons;
  // @ts-ignore - Ignoramos el error de tipo ya que estamos accediendo dinámicamente
  const IconComponent = library[name];

  if (!IconComponent) {
    console.warn(`Icon ${name} not found in Heroicons`);
    return null;
  }

  return (
    <IconComponent
      className={className}
      onClick={onClick}
      aria-hidden="true"
    />
  );
};

export default Icon; 