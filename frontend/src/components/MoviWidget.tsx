import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface MoviWidgetProps {
  currentPage: 'busDashboard' | 'manageRoute';
}

const AGENT_API = 'http://localhost:8000/ai/agent';
const IMAGE_API = 'http://localhost:5000/api/image/parse';

const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const MicIcon = ({isListening}: {isListening: boolean}) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isListening ? 'text-red-500' : ''}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>;
const BotIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect x="4" y="12" width="16" height="8" rx="2" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M12 18v-2" /><path d="M12 8a4 4 0 0 0-4-4" /><path d="M12 8a4 4 0 0 1 4-4" /></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const MessageSquareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

const MoviWidget: React.FC<MoviWidgetProps> = ({ currentPage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [imageText, setImageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);   // NEW
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const speakResponse = (text: string) => {
    if (typeof window.speechSynthesis === 'undefined') {
        console.warn('Speech synthesis not supported');
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  // UPDATED handleSend -------------------------------------------------
  const handleSend = async () => {
    if (!userInput.trim() && !imageText.trim()) return;

    const newUserMessage: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text: userInput,
      imageText: imageText,
    };
    setMessages(prev => [...prev, newUserMessage]);
    const currentInput = userInput;
    const currentImageText = imageText;
    setUserInput('');
    setImageText('');
    setIsLoading(true);
    setError(null);
    setPendingId(null); // reset pending id for new request

    try {
      const apiResponse = await fetch(AGENT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: currentInput,
          imageText: currentImageText,
          currentPage: currentPage,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      // log the full backend response to console — helpful for debugging
      console.log("AI agent raw response:", data);

      // The Python agent returns `message` (and sometimes `response`) — prefer `message`.
      const agentResponseText = data.message || data.response || (data.ok === false ? (data.error || JSON.stringify(data)) : 'Sorry, I could not process that.');


      // if backend asks for confirmation, store pendingId and show appropriate message
      if (data?.confirmationRequired && data?.pendingId) {
        setPendingId(data.pendingId);
      }

      const agentResponse: ChatMessage = {
        id: Date.now() + 1,
        sender: 'agent',
        text: agentResponseText,
      };
      setMessages(prev => [...prev, agentResponse]);

      // speak the message (optional)
      speakResponse(agentResponseText);

    } catch (e: any) {
      console.error(e);
      const errorMessage = 'Failed to get response from agent.';
      setError(errorMessage);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'agent', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  // NEW helper -------------------------------------------------------
  const handleConfirmPending = async () => {
    if (!pendingId) {
      alert("No pending action to confirm.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const apiResponse = await fetch(AGENT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: "yes",
          pendingId: pendingId,
          currentPage: currentPage
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();
      console.log("AI confirm raw response:", data);
      const agentResponseText = data?.message ?? data?.response ?? JSON.stringify(data);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'agent', text: agentResponseText }]);
      speakResponse(agentResponseText);

      // clear pending on success (backend should remove it)
      setPendingId(null);
    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'agent', text: 'Failed to confirm pending action.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingImage(true);
    setImageText('');
    setError(null);
    try {
      const base64Data = await blobToBase64(file);
      
      const apiResponse = await fetch(IMAGE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, mimeType: file.type }),
      });

      if (!apiResponse.ok) {
        throw new Error(`HTTP error! status: ${apiResponse.status}`);
      }
      
      const data = await apiResponse.json();
      setImageText(data.text || '');
      
    } catch (e: any) {
      console.error(e);
      setError("Failed to parse image.");
    } finally {
      setIsParsingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  const handleReset = () => {
    setMessages([]);
    setUserInput('');
    setImageText('');
    setError(null);
    if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel();
    }
  };
  
  const handleVoiceInput = () => {
    if (recognitionRef.current) {
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    } else {
        alert("Sorry, your browser does not support voice recognition.");
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-brand-blue text-white p-4 rounded-full shadow-lg hover:bg-brand-blue-light transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue"
        aria-label="Open Movi AI Chat"
      >
        <MessageSquareIcon />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-xl shadow-2xl flex flex-col border border-brand-gray-200 z-50">
      <header className="flex items-center justify-between p-4 bg-brand-gray-50 border-b border-brand-gray-200 rounded-t-xl">
        <h2 className="font-bold text-lg">Movi AI Assistant</h2>
        <button onClick={() => setIsOpen(false)} className="text-brand-gray-500 hover:text-brand-gray-800"><XIcon /></button>
      </header>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'agent' && <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex-shrink-0 flex items-center justify-center"><BotIcon /></div>}
            <div className={`max-w-xs rounded-lg px-4 py-2 ${msg.sender === 'user' ? 'bg-brand-blue text-white rounded-br-none' : 'bg-brand-gray-100 text-brand-gray-800 rounded-bl-none'}`}>
                <p className="text-sm">{msg.text}</p>
                {msg.imageText && <p className="text-xs mt-2 pt-2 border-t border-white/20 opacity-80"><em>{msg.imageText}</em></p>}
            </div>
            {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-brand-gray-200 text-brand-gray-600 flex-shrink-0 flex items-center justify-center"><UserIcon /></div>}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex-shrink-0 flex items-center justify-center animate-pulse"><BotIcon /></div>
                <div className="max-w-xs rounded-lg px-4 py-2 bg-brand-gray-100 text-brand-gray-800 rounded-bl-none">
                    <div className="h-2 bg-gray-300 rounded-full w-24 animate-pulse"></div>
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {isParsingImage && (
        <div className="px-4 pb-2 text-sm text-blue-700">
            Parsing image...
        </div>
      )}
      {imageText && !isParsingImage && (
          <div className="px-4 pb-2 text-sm text-green-700">
              Image text parsed. Ready to send.
          </div>
      )}

      <div className="p-4 border-t border-brand-gray-200 bg-white rounded-b-xl">
        <div className="flex items-center gap-2">
            <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask Movi anything..."
                className="flex-1 p-2 border border-brand-gray-300 rounded-md focus:ring-brand-blue focus:border-brand-blue"
            />
            <button onClick={handleVoiceInput} className="p-2 text-brand-gray-600 hover:text-brand-blue"><MicIcon isListening={isListening}/></button>
            <button onClick={handleSend} className="p-2 bg-brand-blue text-white rounded-md hover:bg-brand-blue-light"><SendIcon /></button>
        </div>
        <div className="flex justify-between items-center mt-2">
            <div className="flex gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} className="text-xs flex items-center gap-1 text-brand-gray-600 hover:text-brand-blue" disabled={isParsingImage}><ImageIcon/> Parse Image</button>
              {/* UPDATED Confirm Pending button */}
              <button
                className="text-xs text-brand-gray-600 hover:text-brand-blue"
                onClick={handleConfirmPending}
                disabled={!pendingId || isLoading}
                title={pendingId ? `Pending: ${pendingId}` : "No pending action"}
              >
                {pendingId ? `Confirm Pending (${pendingId})` : "Confirm Pending"}
              </button>
            </div>
            <button onClick={handleReset} className="text-xs text-red-500 hover:underline">Reset</button>
        </div>
      </div>
    </div>
  );
};

export default MoviWidget;