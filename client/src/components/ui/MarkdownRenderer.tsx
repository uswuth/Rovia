import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight Markdown / Rich Text parser for AI Summaries.
 * Renders bold, italics, inline code, headers, unordered lists, and line breaks without extra dependencies.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');

  const renderInline = (text: string): React.ReactNode => {
    // Split by markdown tokens: **bold**, *italic*, `code`
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return <em key={index} className="italic text-foreground">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={index} className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className={`space-y-2 text-xs sm:text-sm leading-relaxed text-foreground ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-1.5">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-foreground pt-2">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-foreground pt-2.5">
              {renderInline(trimmed.slice(2))}
            </h2>
          );
        }

        // Unordered lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered lists
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-semibold text-primary text-xs shrink-0 mt-0.5">
                {numberedMatch[1]}.
              </span>
              <span>{renderInline(numberedMatch[2])}</span>
            </div>
          );
        }

        return <p key={idx}>{renderInline(line)}</p>;
      })}
    </div>
  );
};
