import React from 'react';

export const AudioVisualizer = () => {
  return (
    <div className="w-16 h-12 flex justify-center items-center">
      <svg
        className="w-full h-full"
        viewBox="0 0 64 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 0 24 C 10 10, 22 10, 32 24 S 54 38, 64 24"
          stroke="#9ca3af"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="wave"
        />
      </svg>
    </div>
  );
};

// We need to inject the keyframes animation into the global CSS.
// A good place for this would be in your main `index.css` file.
/*
.wave {
  animation: wave 1.5s infinite linear;
}

@keyframes wave {
  0% {
    d: path("M 0 24 C 10 10, 22 10, 32 24 S 54 38, 64 24");
  }
  50% {
    d: path("M 0 24 C 10 38, 22 38, 32 24 S 54 10, 64 24");
  }
  100% {
    d: path("M 0 24 C 10 10, 22 10, 32 24 S 54 38, 64 24");
  }
}
*/