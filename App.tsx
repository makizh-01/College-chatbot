import React, { useState } from 'react';
import ThreeBackground from './components/ThreeBackground';
import ChatInterface from './components/ChatInterface';
import { Language } from './types';

function App() {
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900">
      {/* 3D Background Layer */}
      <ThreeBackground />

      {/* Main Content Layer */}
      <main className="relative z-10 w-full h-full">
        <ChatInterface 
          language={language}
          onLanguageChange={setLanguage}
        />
      </main>
    </div>
  );
}

export default App;