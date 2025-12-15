import React, { useState, useEffect, useRef } from 'react';
import { Message, Language } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { marked } from 'marked';

interface ChatInterfaceProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ language, onLanguageChange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition and Load Voices
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Update recognition language when prop changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language;
    }
  }, [language]);

  // Handle Language Change - Reset chat and show appropriate greeting
  useEffect(() => {
    window.speechSynthesis.cancel();

    const greetingText = language === Language.TAMIL 
      ? "வணக்கம்! நான் சங்கரா கனெக்ட் (SankaraConnect). சங்கரா கல்லூரி பற்றிய உங்கள் கேள்விகளை என்னிடம் கேட்கலாம்." 
      : "Hello! I am SankaraConnect. Ask me anything about Sankara College.";
    
    const greetingSpeech = language === Language.TAMIL
      ? "Vanakkam! Naan Sankara Connect. Sankara kalluri patriya ungal kelvigalai ennidam ketkalam."
      : undefined;

    setMessages([{
      id: Date.now().toString(),
      role: 'model',
      text: greetingText,
      speechText: greetingSpeech,
      timestamp: new Date(),
      suggestions: language === Language.TAMIL 
        ? ["கல்லூரியில் வழங்கப்படும் படிப்புகள்?", "விடுதி வசதிகள் உள்ளனவா?", "விண்ணப்பிப்பது எப்படி?"]
        : ["What courses are offered?", "Are there hostel facilities?", "How do I apply?"]
    }]);
  }, [language]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech synthesis not supported");
      return;
    }

    // Cancel any current speech to start fresh
    window.speechSynthesis.cancel();

    // Clean text
    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    // Split text into sentences/segments to handle mixed language better.
    // This regex splits by punctuation (.!?) but keeps the punctuation.
    const segments = cleanText.match(/[^.!?\n]+[.!?\n]*|./g) || [cleanText];

    // Get latest voices (fallback to state if getVoices returns empty which happens on some browsers)
    const voices = window.speechSynthesis.getVoices().length > 0 
      ? window.speechSynthesis.getVoices() 
      : availableVoices;

    segments.forEach((segment) => {
      const trimmedSegment = segment.trim();
      if (!trimmedSegment) return;

      const utterance = new SpeechSynthesisUtterance(trimmedSegment);
      
      // Check if this specific segment has Tamil characters
      // NOTE: If using Tanglish (transliterated), this will be false, triggering the English/Default logic which is correct.
      const hasTamilChars = /[\u0B80-\u0BFF]/.test(trimmedSegment);

      if (hasTamilChars) {
        // --- Tamil Logic ---
        utterance.lang = 'ta-IN';
        utterance.rate = 1.25; // Increased speed for Tamil script (was 1.1)
        
        // Find a Tamil voice
        let tamilVoice = voices.find(v => v.lang === 'ta-IN' || v.lang === 'ta_IN');
        if (!tamilVoice) {
          tamilVoice = voices.find(v => v.name.toLowerCase().includes('tamil'));
        }
        if (!tamilVoice) {
           tamilVoice = voices.find(v => v.lang.toLowerCase().startsWith('ta'));
        }
        
        if (tamilVoice) {
          utterance.voice = tamilVoice;
        }
      } else {
        // --- English/Default Logic (handles Tanglish too) ---
        utterance.lang = 'en-US';
        utterance.rate = 1.4; // Increased speed for English/Tanglish (was 1.2)
        
        // Try to find a clear English voice
        let engVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en_US');
        if (!engVoice) {
           engVoice = voices.find(v => v.lang.startsWith('en'));
        }
        
        if (engVoice) {
          utterance.voice = engVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    });
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const result = await sendMessageToGemini(messages, textToSend, language);

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: result.text,
      speechText: result.speechText,
      sources: result.sources,
      suggestions: result.suggestions,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 md:p-6 relative z-10">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 bg-white/10 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20">
        <div className="flex items-center gap-3">
          <img 
            src="https://www.eduska.com/assets/user_logo/f59fd8ecbd0242f1ca62994240cc826e.jpg" 
            alt="Sankara Logo" 
            className="w-10 h-10 rounded-full object-cover shadow-md bg-white"
          />
          <div>
            <h1 className="text-xl font-bold text-white">SankaraConnect</h1>
            <p className="text-xs text-indigo-200">Official College Assistant</p>
          </div>
        </div>
        
        <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
          <button 
            onClick={() => onLanguageChange(Language.ENGLISH)}
            className={`px-3 py-1 text-sm rounded-md transition-all ${language === Language.ENGLISH ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'}`}
          >
            ENG
          </button>
          <button 
             onClick={() => onLanguageChange(Language.TAMIL)}
             className={`px-3 py-1 text-sm rounded-md transition-all ${language === Language.TAMIL ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'}`}
          >
            தமிழ்
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-4 scrollbar-thin scrollbar-thumb-indigo-500/50 scrollbar-track-transparent">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-lg backdrop-blur-md border ${
                msg.role === 'user'
                  ? 'bg-indigo-600/80 text-white border-indigo-500/50 rounded-br-none'
                  : 'bg-white/10 text-white border-white/20 rounded-bl-none'
              }`}
            >
              <div 
                className="prose prose-sm max-w-none text-inherit prose-headings:text-white prose-p:text-white prose-strong:text-white prose-a:text-indigo-300"
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }} 
              />
              
              {/* Suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(suggestion)}
                      className="text-xs px-3 py-2 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/30 text-indigo-100 transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Footer: Sources & TTS Button */}
              {(msg.role === 'model' || (msg.sources && msg.sources.length > 0)) && (
                <div className={`mt-3 pt-2 border-t ${msg.role === 'user' ? 'border-indigo-400/30' : 'border-white/10'} flex flex-col gap-2`}>
                  
                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="w-full">
                      <p className={`text-xs font-semibold mb-1 opacity-70 ${msg.role === 'user' ? 'text-indigo-100' : 'text-gray-300'}`}>Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.slice(0, 3).map((source, idx) => (
                          <a 
                            key={idx}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs px-2 py-1 rounded truncate max-w-[150px] transition-colors ${
                              msg.role === 'user' 
                                ? 'bg-indigo-700/50 hover:bg-indigo-700 text-indigo-100' 
                                : 'bg-white/10 hover:bg-white/20 text-gray-200'
                            }`}
                          >
                            {new URL(source).hostname}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Speak Button */}
                  {msg.role === 'model' && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => speakText(msg.speechText || msg.text)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-indigo-300 text-xs font-medium transition-colors border border-white/10"
                        title={msg.speechText ? "Listen in Tanglish" : "Listen"}
                      >
                        <span className="material-icons text-[16px]">volume_up</span>
                        <span>Listen</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white/10 backdrop-blur-md text-white rounded-2xl rounded-bl-none p-4 shadow-lg border border-white/20">
               <div className="flex gap-2">
                 <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                 <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
               </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-transparent backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all duration-300 ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title="Toggle Voice Input"
          >
            <span className="material-icons">{isListening ? 'mic' : 'mic_none'}</span>
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={language === Language.TAMIL ? "சங்கரா கல்லூரி பற்றி கேட்கவும்..." : "Ask about Sankara College..."}
            className="flex-1 bg-transparent border-none text-white placeholder-white/50 focus:ring-0 focus:outline-none px-4 py-2"
          />
          
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-lg"
          >
            <span className="material-icons">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;