import React, { useState, useEffect, useRef } from "react";
import { X, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  messageId: string;
  rating: "thumbs_up" | "thumbs_down";
  initialReason?: string;
  onClose: () => void;
  onSubmit: (messageId: string, rating: "thumbs_up" | "thumbs_down", reason: string) => Promise<void>;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  messageId,
  rating,
  initialReason = "",
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState(initialReason);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReason(initialReason);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, initialReason]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(messageId, rating, reason.trim());
      onClose();
    } catch {
      // Error handled by parent toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-bg-card border border-border-subtle shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                rating === "thumbs_up"
                  ? "bg-status-success-bg text-status-success-text"
                  : "bg-status-danger-bg text-status-danger-text"
              }`}
            >
              {rating === "thumbs_up" ? (
                <ThumbsUp className="w-4 h-4" />
              ) : (
                <ThumbsDown className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 id="feedback-modal-title" className="text-sm font-bold text-text-primary">
                {rating === "thumbs_up" ? "Helpful Response" : "Report Issue or Inaccuracy"}
              </h3>
              <p className="text-xs text-text-muted">
                {rating === "thumbs_up"
                  ? "What made this statutory answer accurate or clear?"
                  : "How could this statutory explanation be improved?"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Close feedback modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="feedback-reason" className="sr-only">
              Feedback reason
            </label>
            <textarea
              id="feedback-reason"
              ref={textareaRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add optional notes (e.g. wrong penalty amount, missing clause, clear explanation)..."
              maxLength={500}
              rows={4}
              className="w-full p-3 rounded-xl border border-border-strong bg-bg-primary text-text-primary text-xs sm:text-sm focus:border-accent-primary focus:outline-none resize-none leading-relaxed"
            />
            <div className="text-right text-[11px] text-text-muted mt-1">
              {reason.length} / 500 characters
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-accent-primary hover:bg-accent-hover text-white transition-colors shadow-xs disabled:opacity-50 min-h-[38px]"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
