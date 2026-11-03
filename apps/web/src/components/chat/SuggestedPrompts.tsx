import React from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";

interface SuggestedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

const PROMPTS = [
  {
    category: "Fines & Penalties",
    text: "What is the statutory fine for riding without a helmet or triple riding under Section 194C?",
  },
  {
    category: "Documents & DigiLocker",
    text: "Can traffic police reject digital RC and Driving Licence presented via DigiLocker or mParivahan?",
  },
  {
    category: "Severe Violations",
    text: "What is the legal punishment and penalty for drunk driving under Section 185?",
  },
  {
    category: "Licensing & Renewal",
    text: "What is the grace period and procedure for renewing an expired driving licence?",
  },
  {
    category: "Minor / Juveniles",
    text: "What are the legal consequences for parents if a minor is caught driving under Section 199A?",
  },
  {
    category: "Emergency Passage",
    text: "What is the fine and punishment for not giving passage to an ambulance or fire vehicle?",
  },
];

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelectPrompt }) => {
  return (
    <div className="space-y-4 max-w-2xl mx-auto py-8">
      <div className="flex items-center gap-2 justify-center text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
        <Sparkles className="w-4 h-4" />
        Suggested Citizen Legal Queries
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROMPTS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(p.text)}
            className="group text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-sm transition flex flex-col justify-between"
          >
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              {p.category}
            </span>
            <div className="flex items-start justify-between gap-2 mt-1">
              <span className="text-xs text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition font-medium">
                {p.text}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary-500 shrink-0 transition" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
