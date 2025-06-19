import React from 'react';

const Bar = ({ height, delay }: { height: string; delay: string }) => (
  <div
    className="w-1.5 bg-gray-400 rounded-full"
    style={{
      height,
      animation: `pulse 1.5s infinite ease-in-out ${delay}`,
    }}
  />
);

export const AudioVisualizer = () => {
  const bars = [
    { height: '20%', delay: '0.1s' },
    { height: '50%', delay: '0.2s' },
    { height: '80%', delay: '0.3s' },
    { height: '40%', delay: '0.4s' },
    { height: '70%', delay: '0.5s' },
    { height: '30%', delay: '0.6s' },
    { height: '60%', delay: '0.7s' },
  ];

  return (
    <div className="flex items-center justify-center space-x-1.5 h-12">
      {bars.map((bar, index) => (
        <Bar key={index} height={bar.height} delay={bar.delay} />
      ))}
    </div>
  );
};

// We need to inject the keyframes animation into the global CSS.
// A good place for this would be in your main `index.css` file.
/*
@keyframes pulse {
  0%, 100% {
    transform: scaleY(0.2);
    opacity: 0.4;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}
*/