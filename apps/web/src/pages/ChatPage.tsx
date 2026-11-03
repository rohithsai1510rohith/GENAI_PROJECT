import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Send,
  Square,
  Plus,
  Trash2,
  Clock,
  WifiOff,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ArrowDown,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { MessageBubble } from "../components/chat/MessageBubble";
import { FilterBar } from "../components/chat/FilterBar";
import { streamChat } from "../services/api";
import { Message, ChatSession } from "../types";
import { SEO } from "../components/common/SEO";

function groupSessions(sessions: ChatSession[]) {
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const earlier: ChatSession[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;

  for (const sess of sessions) {
    const time = new Date(sess.createdAt || Date.now()).getTime();
    if (time >= startOfToday) {
      today.push(sess);
    } else if (time >= startOfYesterday) {
      yesterday.push(sess);
    } else {
      earlier.push(sess);
    }
  }

  return { today, yesterday, earlier };
}

export const ChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputText, setInputText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  const {
    anonymousId,
    sessions,
    activeSessionId,
    filters,
    isStreaming,
    briefMode,
    rateLimitCountdown,
    createNewSession,
    setActiveSession,
    deleteSession,
    clearAllSessions,
    setBriefMode,
    addMessage,
    setStreamCard,
    appendStreamToken,
    setStreamSources,
    setStreamRelated,
    finalizeStream,
    cancelStream,
    setRateLimitCountdown,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  // Group sessions by date
  const groupedSessions = useMemo(() => groupSessions(sessions), [sessions]);

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Rate limit countdown tick
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCountdown(rateLimitCountdown - 1 <= 0 ? null : rateLimitCountdown - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown, setRateLimitCountdown]);

  // Scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (!showScrollBottomPill) {
      scrollToBottom();
    }
  }, [messages.length, messages[messages.length - 1]?.content, messages[messages.length - 1]?.card]);

  // Handle scroll to detect if user has scrolled away from bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottomPill(distanceToBottom > 150);
  };

  // URL query ?q=...
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.trim().length >= 3 && !isStreaming) {
      searchParams.delete("q");
      setSearchParams(searchParams, { replace: true });
      handleSendMessage(q.trim());
    }
  }, [searchParams]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (query.length < 3 || query.length > 500 || isStreaming || rateLimitCountdown !== null) {
      return;
    }

    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 1. User message
    const userMsgId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`;
    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    // 2. Assistant placeholder
    const assistantMsgId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ast-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isStreaming: true,
      sources: [],
    };
    addMessage(assistantMessage);

    // 3. Initiate SSE Streaming
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // History payload (last 4 turns)
    const historyPayload = messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validatedSessionId = UUID_REGEX.test(activeSessionId) ? activeSessionId : undefined;

    await streamChat({
      question: query,
      anonymousId,
      sessionId: validatedSessionId,
      filters: {
        jurisdiction: filters.jurisdiction !== "All" ? filters.jurisdiction : undefined,
        topic: filters.topic !== "All" ? filters.topic : undefined,
      },
      history: historyPayload,
      signal: controller.signal,
      onMeta: () => {},
      onCard: (card) => {
        setStreamCard(card);
      },
      onToken: (token) => {
        appendStreamToken(token);
      },
      onSources: (data) => {
        setStreamSources(data.sources, {
          confidenceTier: data.confidenceTier,
          grounded: data.grounded,
          containsTestData: data.containsTestData,
          allVerified: data.allVerified,
          anyUnverifiedOrSample: data.anyUnverifiedOrSample,
          isReviewDue: data.isReviewDue,
        });
      },
      onRelated: (questions) => {
        setStreamRelated(questions);
      },
      onDone: (data) => {
        finalizeStream({
          id: data.messageId || assistantMsgId,
          latencyMs: data.latencyMs,
        });
        abortControllerRef.current = null;
        setSrAnnouncement("Response completed with statutory citations.");
      },
      onRateLimited: (seconds) => {
        setRateLimitCountdown(seconds);
      },
      onError: (err) => {
        finalizeStream({
          errored: true,
          errorMessage: err.message,
          content: `⚠️ **Unable to complete response**: ${err.message}`,
        });
        abortControllerRef.current = null;
      },
    });
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      cancelStream();
    }
  };

  const handleRegenerate = () => {
    if (isStreaming) return;
    // Find last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        handleSendMessage(messages[i].content);
        break;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 4 Starter Prompt Cards for Empty State
  const starterPrompts = [
    {
      title: "Helmet Mandate & Pillion",
      query: "What is the fine for riding without a helmet under Section 129?",
      section: "Section 129 & 194D",
    },
    {
      title: "Driving Licence Absence",
      query: "What is the penalty for driving without a valid driving licence under Section 181?",
      section: "Section 181",
    },
    {
      title: "Red Light & Signal Violation",
      query: "What are the rules and penalties for red light jumping under Section 184?",
      section: "Section 184",
    },
    {
      title: "Physical Documents & DigiLocker",
      query: "Can traffic police demand physical documents if DigiLocker or mParivahan is presented under Rule 139?",
      section: "Rule 139 & SO 4379(E)",
    },
  ];

  const charCount = inputText.length;
  const isCharCountValid = charCount >= 3 && charCount <= 500;

  const renderSessionItem = (sess: ChatSession) => {
    const isActive = sess.id === activeSessionId;
    return (
      <div
        key={sess.id}
        className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer ${
          isActive
            ? "bg-accent-light text-accent-primary font-semibold border border-accent-primary/20"
            : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary border border-transparent"
        }`}
        onClick={() => {
          setActiveSession(sess.id);
          setSidebarOpen(false);
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{sess.title}</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            deleteSession(sess.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-border-subtle text-text-muted hover:text-rose-600 transition-opacity"
          aria-label={`Delete conversation ${sess.title}`}
          title="Delete query"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="h-[calc(100dvh-4rem)] flex overflow-hidden relative bg-bg-primary">
      <SEO
        title="Interactive Traffic Rules & Fines Assistant"
        description="Ask natural language questions on traffic violations, statutory fines, licensing procedures, and road safety regulations with transparent source citations."
        canonicalPath="/chat"
      />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* 1. Left Sidebar: Conversation History Grouped (Desktop + Mobile Sheet) */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-30 w-72 bg-bg-card border-r border-border-subtle flex flex-col transition-transform duration-200 ease-in-out`}
        aria-label="Conversation History"
      >
        <div className="p-3.5 border-b border-border-subtle flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              createNewSession();
              setSidebarOpen(false);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold shadow-xs transition-colors min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {sessions.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear all conversations from local history?")) {
                  clearAllSessions();
                }
              }}
              className="p-2 rounded-xl text-text-muted hover:text-rose-600 hover:bg-bg-secondary transition-colors"
              title="Clear all conversations"
              aria-label="Clear all conversations"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Grouped Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {groupedSessions.today.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2 block">
                Today
              </span>
              {groupedSessions.today.map(renderSessionItem)}
            </div>
          )}

          {groupedSessions.yesterday.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2 block">
                Yesterday
              </span>
              {groupedSessions.yesterday.map(renderSessionItem)}
            </div>
          )}

          {groupedSessions.earlier.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2 block">
                Earlier
              </span>
              {groupedSessions.earlier.map(renderSessionItem)}
            </div>
          )}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-xs text-text-muted">
              No conversations yet.
            </div>
          )}
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Main Chat Viewport */}
      <section className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Control Bar: Mobile Toggle, FilterBar & Brief/Detailed Toggle */}
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-card px-2 sm:px-4 py-2 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 text-text-muted hover:text-text-primary rounded-lg border border-border-subtle min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label="Toggle conversation history"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <div className="flex-1 min-w-0 overflow-x-auto">
              <FilterBar />
            </div>
          </div>

          {/* Right Header Status & Brief/Detailed Toggle */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Header Status (Part 1 Item 5) */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Knowledge base online</span>
            </div>

            {/* Brief / Detailed Mode Toggle (Part 4 Item 3) */}
            <button
              type="button"
              onClick={() => setBriefMode(!briefMode)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-primary border border-border-subtle transition-all"
              title={briefMode ? "Switch to Detailed Mode (expands full clauses)" : "Switch to Brief Mode (collapses detailed descriptions)"}
              aria-label="Toggle Brief or Detailed answer mode"
            >
              <Layers className="w-3.5 h-3.5 text-accent-primary" />
              <span>{briefMode ? "Brief" : "Detailed"}</span>
            </button>
          </div>
        </div>

        {/* Offline & 429 Countdown Banners */}
        {!isOnline && (
          <div
            role="status"
            className="bg-status-danger-bg border-b border-status-danger-border text-status-danger-text px-4 py-2 text-xs font-medium flex items-center justify-center gap-2"
          >
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline. Please check your network connection.</span>
          </div>
        )}

        {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
          <div
            role="alert"
            className="bg-status-warning-bg border-b border-status-warning-border text-status-warning-text px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in duration-200"
          >
            <Clock className="w-4 h-4 animate-spin" />
            <span>Rate limit reached. Please wait {rateLimitCountdown} seconds before asking again.</span>
          </div>
        )}

        {/* Message Feed Area (Centered 760-800px column) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          role="log"
          aria-label="Conversation Messages"
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 relative"
        >
          <div className="max-w-[780px] mx-auto space-y-4">
            {/* Empty State / 4 Starter Prompt Cards */}
            {messages.length === 0 ? (
              <div className="py-8 md:py-12 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-accent-light text-accent-primary flex items-center justify-center mx-auto shadow-xs border border-accent-primary/20">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
                    Indian Statutory Traffic Assistant
                  </h2>
                  <p className="text-xs sm:text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
                    Verify statutory penalty amounts, licence disqualifications, and mandatory document provisions
                    directly against the Motor Vehicles Act 1988 &amp; Central Motor Vehicles Rules 1989.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {starterPrompts.map((card, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(card.query)}
                      className="p-4 rounded-2xl border border-border-subtle bg-bg-card hover:bg-bg-secondary hover:border-accent-primary/40 text-left transition-all shadow-2xs group flex flex-col justify-between space-y-2 min-h-[90px]"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-primary block mb-1">
                          {card.section}
                        </span>
                        <p className="text-xs font-semibold text-text-primary group-hover:text-accent-primary transition-colors leading-snug">
                          {card.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-text-muted line-clamp-2">
                        {card.query}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                  onRegenerate={handleRegenerate}
                />
              ))
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Jump to latest floating pill button */}
          {showScrollBottomPill && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="fixed bottom-28 right-6 md:right-12 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-primary text-white text-xs font-semibold shadow-lg hover:bg-accent-hover transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
              aria-label="Jump to latest message"
            >
              <span>Jump to latest</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Input Area Pinned at Bottom */}
        <div className="p-3 sm:p-4 bg-bg-card border-t border-border-subtle flex-shrink-0">
          <div className="max-w-[780px] mx-auto space-y-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative rounded-2xl border-2 border-border-strong bg-bg-primary focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-light transition-all p-2 shadow-xs"
            >
              <label htmlFor="chat-input-textarea" className="sr-only">
                Ask a traffic law question
              </label>
              <textarea
                id="chat-input-textarea"
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about fines, Section 129, driving licence, Rule 139, red light..."
                rows={1}
                maxLength={500}
                disabled={rateLimitCountdown !== null}
                className="w-full px-2 py-1.5 text-xs sm:text-sm bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none resize-none leading-relaxed min-h-[40px]"
              />

              {/* Bottom Form Toolbar */}
              <div className="flex items-center justify-between pt-1 px-1 border-t border-border-subtle/50 text-[11px] text-text-muted">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      charCount > 500 || (charCount > 0 && charCount < 3)
                        ? "text-rose-500 font-semibold"
                        : charCount >= 400
                        ? "text-amber-500 font-semibold"
                        : "text-text-muted"
                    }
                  >
                    {charCount} / 500 characters
                  </span>
                  {charCount > 0 && charCount < 3 && (
                    <span className="text-rose-500 hidden sm:inline">(Min 3 characters)</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleStopGenerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-danger-bg text-status-danger-text border border-status-danger-border hover:bg-rose-100 font-semibold text-xs transition-colors min-h-[36px]"
                      aria-label="Stop generating response"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Generating</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!isCharCountValid || rateLimitCountdown !== null}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-primary hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-xs transition-colors min-h-[36px]"
                      aria-label="Send query"
                    >
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Hint Line below composer (Part 1 Item 5 & Part 5 Item 4) */}
            <p className="text-[11px] text-text-muted text-center leading-normal px-2">
              Informational, not legal advice. Fines can change by notification; confirm with the transport authority.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChatPage;
