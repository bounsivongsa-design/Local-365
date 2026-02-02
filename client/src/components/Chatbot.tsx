import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  text: string;
  sender: 'bot' | 'user';
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hey, I'm Ziggy, your OBX AI expert! What can I help with?", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage: string): string => {
    const lowerMsg = userMessage.toLowerCase();
    
    if (lowerMsg.includes('deck') || lowerMsg.includes('build')) {
      return "For decks in OBX, typical range is $6K–$15K depending on size and materials. Want me to connect you to a local pro?";
    }
    if (lowerMsg.includes('restaurant') || lowerMsg.includes('food') || lowerMsg.includes('eat')) {
      return "Great seafood spots include Sam & Omie's in Nags Head, Coastal Provisions in Southern Shores, and The Blue Point in Duck. What cuisine are you craving?";
    }
    if (lowerMsg.includes('beach') || lowerMsg.includes('swim')) {
      return "The best beaches depend on what you're looking for! Corolla for wild horses, Nags Head for classic vibes, or Hatteras for less crowds. Need specific recommendations?";
    }
    if (lowerMsg.includes('weather')) {
      return "OBX weather can be unpredictable! Generally mild winters (40-50°F) and warm summers (80-90°F). Always pack layers and check the forecast before heading out!";
    }
    if (lowerMsg.includes('wild horse') || lowerMsg.includes('corolla')) {
      return "Wild horse tours in Corolla are amazing! Book with Corolla Wild Horse Tours or Wild Horse Adventure Tours. Best times are early morning or late afternoon.";
    }
    if (lowerMsg.includes('fish') || lowerMsg.includes('charter')) {
      return "OBX is a fishing paradise! Inshore, offshore, and pier fishing all available. Oregon Inlet has great charter options. What type of fishing interests you?";
    }
    if (lowerMsg.includes('stay') || lowerMsg.includes('hotel') || lowerMsg.includes('rental')) {
      return "Vacation rentals are popular here! Check VRBO, Airbnb, or local companies like Sun Realty and Twiddy. Which town are you interested in staying?";
    }
    if (lowerMsg.includes('kid') || lowerMsg.includes('family') || lowerMsg.includes('children')) {
      return "Family fun! NC Aquarium on Roanoke Island, Jockey's Ridge for sandboarding, Wright Brothers Memorial, and mini golf everywhere. Kids love it here!";
    }
    if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey')) {
      return "Hey there! Welcome to OBX! I can help with restaurants, beaches, activities, contractors, and more. What brings you to the Outer Banks?";
    }
    
    return "That's a great question! I can help with OBX restaurants, beaches, activities, local pros, and trip planning. What specifically would you like to know?";
  };

  const handleSend = () => {
    if (input.trim()) {
      const userMessage = input.trim();
      setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
      setInput('');
      setIsTyping(true);
      
      setTimeout(() => {
        const response = getBotResponse(userMessage);
        setMessages(prev => [...prev, { text: response, sender: 'bot' }]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all z-50"
          size="icon"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-80 sm:w-96 h-[480px] flex flex-col shadow-2xl z-50 overflow-hidden" data-testid="chat-window">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold">Ziggy</h3>
                <p className="text-xs text-primary-foreground/70">Your OBX AI Expert</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:bg-white/20"
              data-testid="button-close-chat"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2",
                  msg.sender === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.sender === 'bot' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    msg.sender === 'user'
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white border rounded-bl-sm"
                  )}
                >
                  {msg.text}
                </div>
                {msg.sender === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button 
                onClick={handleSend} 
                size="icon"
                disabled={!input.trim()}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

export default Chatbot;
