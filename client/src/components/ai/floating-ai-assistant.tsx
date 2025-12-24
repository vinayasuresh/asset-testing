import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedRequest } from "@/lib/auth";
import { Bot, Send, Sparkles, X, ChevronDown, History, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Navigation link mappings for smart AI responses
const NAVIGATION_LINKS: Array<{
  keywords: RegExp;
  path: string;
  label: string;
  description: string;
}> = [
  { keywords: /\b(high[- ]?risk|risk[- ]?assets?|compliance issues?)\b/i, path: "/dashboard/compliance", label: "Compliance & Risk", description: "View high-risk assets and compliance issues" },
  { keywords: /\b(hardware|laptop|desktop|computer|device|server)\b/i, path: "/assets?type=hardware", label: "Hardware Assets", description: "View all hardware assets" },
  { keywords: /\b(software|license|application|app)\b/i, path: "/software", label: "Software & Licenses", description: "View software and licenses" },
  { keywords: /\b(ticket|support|request|issue)\b/i, path: "/tickets", label: "Tickets", description: "View support tickets" },
  { keywords: /\b(user|employee|staff|team|assigned)\b/i, path: "/users", label: "Users", description: "View user directory" },
  { keywords: /\b(vendor|supplier|contract)\b/i, path: "/vendors", label: "Vendors", description: "View vendor information" },
  { keywords: /\b(discover|shadow[- ]?it|saas|cloud)\b/i, path: "/discovery-dashboard", label: "Shadow IT Discovery", description: "View discovered SaaS applications" },
  { keywords: /\b(saas[- ]?apps?|applications?)\b/i, path: "/saas-apps", label: "SaaS Applications", description: "View all SaaS applications" },
  { keywords: /\b(spend|cost|budget|expense)\b/i, path: "/spend-dashboard", label: "Spend Dashboard", description: "View IT spending overview" },
  { keywords: /\b(access[- ]?review|permission|role)\b/i, path: "/access-reviews", label: "Access Reviews", description: "Review user access permissions" },
  { keywords: /\b(governance|policy|policies)\b/i, path: "/governance-policies", label: "Governance Policies", description: "View governance policies" },
  { keywords: /\b(identity|idp|sso|authentication)\b/i, path: "/identity-providers", label: "Identity Providers", description: "Configure identity providers" },
  { keywords: /\b(warranty|warranties|expir)\b/i, path: "/assets?filter=warranty", label: "Warranty Status", description: "View warranty information" },
  { keywords: /\b(unassigned|available|pool)\b/i, path: "/assets?filter=unassigned", label: "Unassigned Assets", description: "View available assets" },
  { keywords: /\b(deploy|deployed|in[- ]?use)\b/i, path: "/assets?status=deployed", label: "Deployed Assets", description: "View deployed assets" },
  { keywords: /\b(retire|retired|disposal)\b/i, path: "/assets?status=retired", label: "Retired Assets", description: "View retired assets" },
  { keywords: /\b(report|analytics|metric)\b/i, path: "/reports", label: "Reports", description: "View reports and analytics" },
  { keywords: /\b(dashboard|overview|summary)\b/i, path: "/dashboard", label: "Dashboard", description: "Go to main dashboard" },
];

// Function to detect and extract relevant navigation links from content
function extractNavigationLinks(content: string, query: string): Array<{ path: string; label: string; description: string }> {
  const combinedText = `${query} ${content}`.toLowerCase();
  const matchedLinks: Array<{ path: string; label: string; description: string; priority: number }> = [];

  NAVIGATION_LINKS.forEach((link, index) => {
    if (link.keywords.test(combinedText)) {
      matchedLinks.push({ ...link, priority: index });
    }
  });

  // Return unique links, sorted by priority, max 3 links
  const uniquePaths = new Set<string>();
  return matchedLinks
    .sort((a, b) => a.priority - b.priority)
    .filter((link) => {
      if (uniquePaths.has(link.path)) return false;
      uniquePaths.add(link.path);
      return true;
    })
    .slice(0, 3)
    .map(({ path, label, description }) => ({ path, label, description }));
}

interface ConversationHistory {
  id: string;
  messages: Message[];
  createdAt: Date;
  title: string;
}

export function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
  const [lastUserQuery, setLastUserQuery] = useState<string>("");
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Load conversation history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('ai-conversation-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setConversationHistory(parsed);
      } catch (error) {
        console.error('Failed to parse conversation history:', error);
      }
    }
  }, []);

  // Save current conversation to history when it has messages
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai-current-conversation', JSON.stringify(messages));
    }
  }, [messages]);

  // Load current conversation on mount
  useEffect(() => {
    const savedConversation = localStorage.getItem('ai-current-conversation');
    if (savedConversation) {
      try {
        const parsed = JSON.parse(savedConversation);
        setMessages(parsed);
      } catch (error) {
        console.error('Failed to parse current conversation:', error);
      }
    }
  }, []);

  // Scroll to last message
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  if (!user) {
    return null;
  }

  const userDisplayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "You";

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please enter a question about the ITAM portal.",
        variant: "destructive"
      });
      return;
    }

    if (prompt.length > 2000) {
      toast({
        title: "Prompt too long",
        description: "Please keep your question under 2000 characters.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setShowHistory(false);
    const trimmedPrompt = prompt.trim();
    setLastUserQuery(trimmedPrompt); // Track for navigation link extraction
    const newMessage: Message = { role: "user", content: trimmedPrompt, timestamp: new Date() };
    setMessages((prev) => [...prev, newMessage]);
    setPrompt("");

    try {
      const response = await authenticatedRequest("POST", "/api/ai/query", {
        prompt: trimmedPrompt
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantReply = (data.answer || data.summary || data.response || "").trim();
      if (assistantReply) {
        const assistantMessage: Message = { role: "assistant", content: assistantReply, timestamp: new Date() };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Handle empty response from AI
        const fallbackMessage: Message = {
          role: "assistant",
          content: "I received your question but couldn't generate a response. Please try rephrasing your question or try again later.",
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      }

    } catch (error: any) {
      console.error('AI query error:', error);
      setErrorMessage(error?.message || "There was an error processing your request. Please try again.");
      toast({
        title: "AI query failed",
        description: error?.message || "There was an error processing your request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const saveCurrentConversation = () => {
    if (messages.length > 0) {
      const title = messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? '...' : '');
      const newConversation: ConversationHistory = {
        id: Date.now().toString(),
        messages: messages,
        createdAt: new Date(),
        title
      };
      const updatedHistory = [newConversation, ...conversationHistory].slice(0, 10); // Keep last 10 conversations
      setConversationHistory(updatedHistory);
      localStorage.setItem('ai-conversation-history', JSON.stringify(updatedHistory));
    }
  };

  const startNewConversation = () => {
    saveCurrentConversation();
    setMessages([]);
    setErrorMessage("");
    localStorage.removeItem('ai-current-conversation');
    setShowHistory(false);
  };

  const loadConversation = (conversation: ConversationHistory) => {
    saveCurrentConversation();
    setMessages(conversation.messages);
    setShowHistory(false);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = conversationHistory.filter(c => c.id !== id);
    setConversationHistory(updatedHistory);
    localStorage.setItem('ai-conversation-history', JSON.stringify(updatedHistory));
  };

  const clearAllHistory = () => {
    setConversationHistory([]);
    localStorage.removeItem('ai-conversation-history');
  };

  const togglePanel = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsMinimized(false);
    } else if (!isMinimized) {
      setIsMinimized(true);
    } else {
      setIsMinimized(false);
    }
  };

  const closePanel = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <>
      {/* Floating AI Button - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50" data-testid="ai-assistant-container">
        <Button
          size="lg"
          onClick={togglePanel}
          style={{
            background: "var(--ai-button-bg)",
            borderColor: "var(--ai-button-border)",
          }}
          className={cn(
            "rounded-full w-14 h-14 text-white shadow-lg ring-2 ring-[color:var(--ai-button-border)]/40 hover:ring-[color:var(--ai-button-border)]/60 transition-all",
            isOpen && "ring-4"
          )}
          data-testid="button-ai-assistant"
        >
          <Bot className="h-6 w-6 text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.25)]" />
        </Button>
      </div>

      {/* Non-modal AI Panel - Bottom Center - Enlarged 70% wider, 25% taller */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-5xl px-4 transition-all duration-300 ease-in-out",
            isMinimized ? "translate-y-[calc(100%-60px)]" : "translate-y-0"
          )}
          data-testid="ai-panel"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-border cursor-pointer"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">ITAM AI Assistant</h3>
                  <p className="text-sm text-muted-foreground">Ask anything about your assets</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHistory(!showHistory);
                  }}
                  className="h-8 w-8 p-0"
                  title="View history"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    startNewConversation();
                  }}
                  className="h-8 w-8 p-0"
                  title="New conversation"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", !isMinimized && "rotate-180")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    closePanel();
                  }}
                  className="h-8 w-8 p-0 hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Panel Content */}
            {!isMinimized && (
              <div className="flex flex-col max-h-[75vh]">
                {/* History Panel */}
                {showHistory && (
                  <div className="border-b border-border bg-muted/30 p-4 max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Conversations</h4>
                      {conversationHistory.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllHistory}
                          className="h-6 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    {conversationHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No conversation history</p>
                    ) : (
                      <div className="space-y-1">
                        {conversationHistory.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => loadConversation(conv)}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{conv.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(conv.createdAt).toLocaleDateString()} • {conv.messages.length} messages
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => deleteConversation(conv.id, e)}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[250px] max-h-[400px]">
                  {messages.length === 0 && !errorMessage && !isLoading ? (
                    <div className="flex flex-col items-center text-center space-y-3 py-4">
                      <div className="p-3 rounded-xl bg-muted/50">
                        <Sparkles className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Ask me anything about ITAM</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Assets, licenses, users, tickets, or recommendations
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 w-full text-xs">
                        <button
                          onClick={() => setPrompt("How many laptops are deployed?")}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-left truncate"
                        >
                          How many laptops are deployed?
                        </button>
                        <button
                          onClick={() => setPrompt("Show expiring licenses")}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-left truncate"
                        >
                          Show expiring licenses
                        </button>
                        <button
                          onClick={() => setPrompt("Summarize open tickets")}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-left truncate"
                        >
                          Summarize open tickets
                        </button>
                        <button
                          onClick={() => setPrompt("Assets with warranties ending soon")}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-left truncate"
                        >
                          Warranties ending soon
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message, index) => {
                        // Extract navigation links for AI responses
                        const navLinks = message.role === "assistant"
                          ? extractNavigationLinks(message.content, lastUserQuery)
                          : [];

                        return (
                          <div
                            key={`${message.role}-${index}`}
                            ref={index === messages.length - 1 ? lastMessageRef : undefined}
                            className={cn(
                              "p-4 rounded-xl text-base leading-relaxed",
                              message.role === "user"
                                ? "bg-primary/10 border-l-2 border-primary ml-8"
                                : "bg-muted/50 border-l-2 border-blue-500 mr-8"
                            )}
                          >
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {message.role === "user" ? userDisplayName : "AI Assistant"}
                            </p>
                            <div className="whitespace-pre-line">{message.content}</div>

                            {/* Navigation Links for AI responses */}
                            {message.role === "assistant" && navLinks.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-border/50">
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  Quick Navigation
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {navLinks.map((link) => (
                                    <button
                                      key={link.path}
                                      onClick={() => setLocation(link.path)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
                                      title={link.description}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {link.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/30 rounded-xl mr-8">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          Thinking...
                        </div>
                      )}
                      {errorMessage && (
                        <p className="text-sm text-destructive p-3 bg-destructive/10 rounded-xl">
                          {errorMessage}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Input Area */}
                <div className="border-t border-border p-4 bg-background">
                  <div className="flex gap-3">
                    <Textarea
                      ref={inputRef}
                      placeholder="Ask about assets, licenses, users..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="min-h-[56px] max-h-[120px] resize-none text-base"
                      disabled={isLoading}
                      data-testid="textarea-ai-prompt"
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={isLoading || !prompt.trim() || prompt.length > 2000}
                      className="h-auto px-5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      data-testid="button-ai-submit"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                    <span>Press Enter to send</span>
                    {prompt.length > 0 && (
                      <span className={prompt.length > 2000 ? "text-destructive" : ""}>
                        {prompt.length}/2000
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
