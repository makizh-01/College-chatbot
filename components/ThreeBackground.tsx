import React from 'react';

const ThreeBackground: React.FC = () => {
  // Primary image: Updated per user request
  const bgImage = "https://www.sankara.ac.in/science-and-commerce/wp-content/uploads/2021/08/College-Image-1-01-01-455x320.png";
  
  // Fallback image: Sankara College Campus View (Sims Block)
  const fallbackImage = "https://images.shiksha.com/mediadata/images/1563861219phpS0vI4l.jpeg";

  return (
    <div className="absolute inset-0 z-0 bg-slate-900">
      <img 
        src={bgImage}
        alt="Sankara College Campus" 
        className="w-full h-full object-cover"
        onError={(e) => {
          const imgElement = e.currentTarget;
          if (imgElement.src !== fallbackImage) {
            imgElement.src = fallbackImage;
          }
        }}
      />
      {/* Dark gradient overlay to ensure white text is readable against the background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-900/90" />
    </div>
  );
};

export default ThreeBackground;