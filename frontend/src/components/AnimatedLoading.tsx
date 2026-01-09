import React from 'react';

const AnimatedLoading: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <div className="flex justify-center items-center gap-1" style={{ height: size }}>
    <span className="block w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }}></span>
    <span className="block w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.15s' }}></span>
    <span className="block w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '0.3s' }}></span>
    <style>{`
      .animate-bounce {
        display: inline-block;
        animation: bounce 0.7s infinite alternate;
      }
      @keyframes bounce {
        to { transform: translateY(-8px); opacity: 0.7; }
      }
    `}</style>
  </div>
);

export default AnimatedLoading;
