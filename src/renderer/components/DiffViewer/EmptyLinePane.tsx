import React from 'react';

export default function EmptyLinePane() {
  return (
    <div className='w-1/2 flex'>
      <div className='w-10 flex-shrink-0 bg-muted/20' />
      <div className='flex-1 bg-muted/10' />
    </div>
  );
}
