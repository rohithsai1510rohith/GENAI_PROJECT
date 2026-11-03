import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore, getOrCreateAnonymousId } from "../store/chatStore";

describe("ChatStore Zustand Store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates and persists a valid UUID v4 anonymousId", () => {
    const anonId = getOrCreateAnonymousId();
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(UUID_V4_REGEX.test(anonId)).toBe(true);

    // Second call should return the exact same persisted ID
    const secondCall = getOrCreateAnonymousId();
    expect(secondCall).toBe(anonId);
  });

  it("creates a new session and tracks up to 20 sessions", () => {
    const store = useChatStore.getState();
    const initialSessionCount = store.sessions.length;

    const newId = store.createNewSession();
    expect(useChatStore.getState().activeSessionId).toBe(newId);
    expect(useChatStore.getState().sessions.length).toBe(initialSessionCount + 1);

    // Add 25 sessions to assert max 20 capping
    for (let i = 0; i < 25; i++) {
      useChatStore.getState().createNewSession();
    }
    expect(useChatStore.getState().sessions.length).toBeLessThanOrEqual(20);
  });

  it("adds user and assistant messages and appends streaming tokens", () => {
    const store = useChatStore.getState();
    store.createNewSession();

    store.addMessage({
      id: "u1",
      role: "user",
      content: "What is drunk driving fine?",
      timestamp: new Date().toISOString(),
    });

    store.addMessage({
      id: "a1",
      role: "assistant",
      content: "Under Section 185",
      isStreaming: true,
      timestamp: new Date().toISOString(),
    });

    store.appendStreamToken(", the fine is Rs. 10,000.");
    store.finalizeStream({ isStreaming: false });

    const activeSess = useChatStore.getState().sessions.find(
      (s) => s.id === useChatStore.getState().activeSessionId
    );
    expect(activeSess?.messages.length).toBe(2);
    expect(activeSess?.messages[1].content).toBe("Under Section 185, the fine is Rs. 10,000.");
    expect(activeSess?.messages[1].isStreaming).toBe(false);
  });

  it("updates feedback optimistically", () => {
    const store = useChatStore.getState();
    store.addMessage({
      id: "msg-fb-1",
      role: "assistant",
      content: "Helmet fine is Rs. 1,000.",
      timestamp: new Date().toISOString(),
    });

    store.setMessageFeedback("msg-fb-1", "thumbs_up", "Very clear");

    const activeSess = useChatStore.getState().sessions.find(
      (s) => s.id === useChatStore.getState().activeSessionId
    );
    const msg = activeSess?.messages.find((m) => m.id === "msg-fb-1");
    expect(msg?.feedback).toBe("thumbs_up");
    expect(msg?.feedbackReason).toBe("Very clear");
  });
});
