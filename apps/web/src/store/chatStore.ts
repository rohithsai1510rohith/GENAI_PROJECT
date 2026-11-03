import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Message, SourceItem, FilterState, ChatSession, QuickAnswerCardData } from "../types";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

export function getOrCreateAnonymousId(): string {
  if (typeof window === "undefined") return "00000000-0000-4000-8000-000000000000";
  const saved = localStorage.getItem("traffic_anon_id");
  if (saved && UUID_V4_REGEX.test(saved.trim())) {
    return saved.trim();
  }
  const newId = generateUUID();
  localStorage.setItem("traffic_anon_id", newId);
  return newId;
}

interface ChatStoreState {
  anonymousId: string;
  sessions: ChatSession[];
  activeSessionId: string;
  filters: FilterState;
  isStreaming: boolean;
  briefMode: boolean;
  rateLimitCountdown: number | null;
  activeSourceForDrawer: SourceItem | null;

  // Actions
  setFilters: (filters: Partial<FilterState>) => void;
  setBriefMode: (brief: boolean) => void;
  setActiveSession: (sessionId: string) => void;
  createNewSession: () => string;
  deleteSession: (sessionId: string) => void;
  clearAllSessions: () => void;
  addMessage: (message: Message) => void;
  setStreamCard: (card: QuickAnswerCardData) => void;
  appendStreamToken: (text: string) => void;
  setStreamSources: (sources: SourceItem[], extra: Partial<Message>) => void;
  setStreamRelated: (questions: string[]) => void;
  finalizeStream: (extra?: Partial<Message>) => void;
  cancelStream: () => void;
  setMessageFeedback: (messageId: string, rating: "thumbs_up" | "thumbs_down", reason?: string) => void;
  openSourceDrawer: (source: SourceItem) => void;
  closeSourceDrawer: () => void;
  setRateLimitCountdown: (seconds: number | null) => void;
}

const initialSessionId = generateUUID();

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      anonymousId: getOrCreateAnonymousId(),
      sessions: [
        {
          id: initialSessionId,
          title: "New Traffic Inquiry",
          createdAt: new Date().toISOString(),
          messages: [],
        },
      ],
      activeSessionId: initialSessionId,
      filters: {
        jurisdiction: "All",
        topic: "All",
      },
      isStreaming: false,
      briefMode: false,
      rateLimitCountdown: null,
      activeSourceForDrawer: null,

      setFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
      },

      setBriefMode: (brief) => {
        set({ briefMode: brief });
      },

      setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId });
      },

      createNewSession: () => {
        const newId = generateUUID();
        const newSession: ChatSession = {
          id: newId,
          title: "New Traffic Inquiry",
          createdAt: new Date().toISOString(),
          messages: [],
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions.slice(0, 19)], // Keep at most 20 conversations
          activeSessionId: newId,
        }));

        return newId;
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const remaining = state.sessions.filter((s) => s.id !== sessionId);
          if (remaining.length === 0) {
            const freshId = generateUUID();
            return {
              sessions: [
                {
                  id: freshId,
                  title: "New Traffic Inquiry",
                  createdAt: new Date().toISOString(),
                  messages: [],
                },
              ],
              activeSessionId: freshId,
            };
          }
          const nextActive = state.activeSessionId === sessionId ? remaining[0].id : state.activeSessionId;
          return {
            sessions: remaining,
            activeSessionId: nextActive,
          };
        });
      },

      clearAllSessions: () => {
        const freshId = generateUUID();
        set({
          sessions: [
            {
              id: freshId,
              title: "New Traffic Inquiry",
              createdAt: new Date().toISOString(),
              messages: [],
            },
          ],
          activeSessionId: freshId,
        });
      },

      addMessage: (message) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            // Update title on first user message if default
            const newTitle =
              sess.messages.length === 0 && message.role === "user"
                ? message.content.slice(0, 45) + (message.content.length > 45 ? "..." : "")
                : sess.title;
            return {
              ...sess,
              title: newTitle,
              messages: [...sess.messages, message],
            };
          });
          return { sessions, isStreaming: message.isStreaming || false };
        });
      },

      setStreamCard: (card) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            const messages = [...sess.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              messages[messages.length - 1] = {
                ...lastMsg,
                card,
              };
            }
            return { ...sess, messages };
          });
          return { sessions };
        });
      },

      appendStreamToken: (text) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            const messages = [...sess.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
              messages[messages.length - 1] = {
                ...lastMsg,
                content: lastMsg.content + text,
              };
            }
            return { ...sess, messages };
          });
          return { sessions };
        });
      },

      setStreamSources: (sources, extra) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            const messages = [...sess.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              messages[messages.length - 1] = {
                ...lastMsg,
                sources,
                confidenceTier: extra.confidenceTier || lastMsg.confidenceTier,
                grounded: extra.grounded !== undefined ? extra.grounded : lastMsg.grounded,
                containsTestData: extra.containsTestData !== undefined ? extra.containsTestData : lastMsg.containsTestData,
                allVerified: extra.allVerified !== undefined ? extra.allVerified : lastMsg.allVerified,
                anyUnverifiedOrSample: extra.anyUnverifiedOrSample !== undefined ? extra.anyUnverifiedOrSample : lastMsg.anyUnverifiedOrSample,
                isReviewDue: extra.isReviewDue !== undefined ? extra.isReviewDue : lastMsg.isReviewDue,
              };
            }
            return { ...sess, messages };
          });
          return { sessions };
        });
      },

      setStreamRelated: (questions) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            const messages = [...sess.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              messages[messages.length - 1] = {
                ...lastMsg,
                relatedQuestions: questions,
              };
            }
            return { ...sess, messages };
          });
          return { sessions };
        });
      },

      finalizeStream: (extra) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            const messages = [...sess.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              messages[messages.length - 1] = {
                ...lastMsg,
                ...extra,
                isStreaming: false,
              };
            }
            return { ...sess, messages };
          });
          return { sessions, isStreaming: false };
        });
      },

      cancelStream: () => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            if (sess.id !== state.activeSessionId) return sess;
            const messages = [...sess.messages];
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
              messages[messages.length - 1] = {
                ...lastMsg,
                isStreaming: false,
                content: lastMsg.content + "\n\n*(Generation stopped by user)*",
              };
            }
            return { ...sess, messages };
          });
          return { sessions, isStreaming: false };
        });
      },

      setMessageFeedback: (messageId, rating, reason) => {
        set((state) => {
          const sessions = state.sessions.map((sess) => {
            const messages = sess.messages.map((m) => {
              if (m.id === messageId) {
                return {
                  ...m,
                  feedback: rating,
                  feedbackReason: reason,
                };
              }
              return m;
            });
            return { ...sess, messages };
          });
          return { sessions };
        });
      },

      openSourceDrawer: (source) => {
        set({ activeSourceForDrawer: source });
      },

      closeSourceDrawer: () => {
        set({ activeSourceForDrawer: null });
      },

      setRateLimitCountdown: (seconds) => {
        set({ rateLimitCountdown: seconds });
      },
    }),
    {
      name: "traffic_assistant_chat_store",
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        filters: state.filters,
        briefMode: state.briefMode,
      }),
    }
  )
);
