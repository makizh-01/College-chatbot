export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  sources?: string[];
  speechText?: string;
  suggestions?: string[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isListening: boolean;
  isSpeaking: boolean;
}

export enum Language {
  ENGLISH = 'en-US',
  TAMIL = 'ta-IN'
}

// Window augmentation for Speech Recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}