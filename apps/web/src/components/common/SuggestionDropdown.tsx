import React, { useEffect, useRef } from "react";
import { Search, FileText, ChevronRight } from "lucide-react";
import { SuggestionItem } from "../../types";

interface SuggestionDropdownProps {
  suggestions: SuggestionItem[];
  selectedIndex: number;
  onSelect: (item: SuggestionItem) => void;
  visible: boolean;
}

export const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  visible,
}) => {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Live search suggestions"
      className="absolute z-50 left-0 right-0 bottom-full mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span>Official Statutory Matches</span>
        <span className="text-[9px] lowercase font-normal">Use ↑ ↓ and Enter</span>
      </li>
      {suggestions.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <li
            key={idx}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(item)}
            className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition ${
              isSelected
                ? "bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300"
                : "text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden pr-2">
              <Search className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary-600" : "text-slate-400"}`} />
              <div className="truncate">
                <span className="text-xs font-medium block truncate">{item.text}</span>
                <span className="text-[10px] text-slate-400 truncate block">
                  {item.category} {item.section ? `• ${item.section}` : ""}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-70" />
          </li>
        );
      })}
    </ul>
  );
};
