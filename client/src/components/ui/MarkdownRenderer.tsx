import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

type Block =
  | { type: 'header'; level: number; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'details'; summary: string; lines: string[] }
  | { type: 'quote'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; num: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' };

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const renderInline = (text: string): React.ReactNode => {
    // Matches: **bold**, *italic*, `code`, and [link](url)
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);

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
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a
            key={index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  // Parse structured blocks: tables, headers, details/accordions, lists, blockquotes
  const blocks = useMemo(() => {
    if (!content) return [];
    const rawLines = content.split('\n');
    const result: Block[] = [];
    let i = 0;

    const isTableRow = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|');
    const isDividerRow = (l: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l.trim());

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        result.push({ type: 'spacer' });
        i++;
        continue;
      }

      // 1. Collapsible details: <details><summary>Title</summary> ... </details>
      if (trimmed.startsWith('<details>')) {
        let summaryText = 'Details';
        const detailLines: string[] = [];
        i++;
        while (i < rawLines.length && !rawLines[i].trim().includes('</details>')) {
          const dl = rawLines[i].trim();
          const smMatch = dl.match(/<summary>(.*?)<\/summary>/i);
          if (smMatch) {
            summaryText = smMatch[1];
          } else if (dl) {
            detailLines.push(rawLines[i]);
          }
          i++;
        }
        if (i < rawLines.length && rawLines[i].trim().includes('</details>')) {
          i++;
        }
        result.push({ type: 'details', summary: summaryText, lines: detailLines });
        continue;
      }

      // 2. Markdown Tables
      if (isTableRow(trimmed) && i + 1 < rawLines.length && isDividerRow(rawLines[i + 1])) {
        const parseRow = (r: string) =>
          r
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());

        const headers = parseRow(trimmed);
        i += 2; // skip header and divider
        const rows: string[][] = [];

        while (i < rawLines.length && isTableRow(rawLines[i])) {
          rows.push(parseRow(rawLines[i]));
          i++;
        }

        result.push({ type: 'table', headers, rows });
        continue;
      }

      // 3. Headers
      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#{1,6})\s+(.*)/);
        if (match) {
          result.push({ type: 'header', level: match[1].length, text: match[2] });
          i++;
          continue;
        }
      }

      // 4. Blockquotes
      if (trimmed.startsWith('> ')) {
        result.push({ type: 'quote', text: trimmed.slice(2) });
        i++;
        continue;
      }

      // 5. Unordered lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        result.push({ type: 'bullet', text: trimmed.slice(2) });
        i++;
        continue;
      }

      // 6. Numbered lists
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        result.push({ type: 'numbered', num: numberedMatch[1], text: numberedMatch[2] });
        i++;
        continue;
      }

      // 7. Standard Paragraph
      result.push({ type: 'paragraph', text: line });
      i++;
    }

    return result;
  }, [content]);

  if (!content) return null;

  return (
    <div className={`space-y-2.5 text-xs sm:text-sm leading-relaxed text-foreground ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'spacer') {
          return <div key={idx} className="h-1.5" />;
        }

        if (block.type === 'header') {
          if (block.level === 1) {
            return (
              <h2 key={idx} className="text-base font-bold text-foreground pt-3 pb-1 border-b border-border/40">
                {renderInline(block.text)}
              </h2>
            );
          }
          if (block.level === 2) {
            return (
              <h3 key={idx} className="text-sm font-bold text-foreground pt-2.5">
                {renderInline(block.text)}
              </h3>
            );
          }
          return (
            <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">
              {renderInline(block.text)}
            </h4>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={idx} className="my-3 overflow-x-auto rounded-xs border border-border bg-card/60 shadow-2xs">
              <table className="w-full text-left text-xs divide-y divide-border/60">
                <thead className="bg-muted/40 font-semibold text-foreground">
                  <tr>
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2 whitespace-nowrap">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {block.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 align-top text-foreground">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'details') {
          return (
            <details key={idx} className="group my-2 rounded-xs border border-border bg-card/40 overflow-hidden">
              <summary className="flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-foreground cursor-pointer select-none hover:bg-muted/30 transition-colors">
                <span>{renderInline(block.summary)}</span>
                <ChevronDown size={14} className="text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="px-3.5 py-2.5 border-t border-border/40 bg-muted/10 text-xs space-y-1.5">
                <MarkdownRenderer content={block.lines.join('\n')} />
              </div>
            </details>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={idx} className="border-l-2 border-primary/60 bg-muted/20 pl-3 py-1 my-1 text-xs italic text-muted-foreground">
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>{renderInline(block.text)}</span>
            </div>
          );
        }

        if (block.type === 'numbered') {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-semibold text-primary text-xs shrink-0 mt-0.5">
                {block.num}.
              </span>
              <span>{renderInline(block.text)}</span>
            </div>
          );
        }

        return <p key={idx}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
};
