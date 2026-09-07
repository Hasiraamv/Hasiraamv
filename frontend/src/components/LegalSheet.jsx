/** Renders plain-text legal copy (paragraphs separated by blank lines) inside a Sheet. */
export default function LegalSheet({ text }) {
  const blocks = text.trim().split(/\n\n+/);
  return (
    <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pb-2 pr-1">
      {blocks.map((block, i) => (
        <p key={i} className="whitespace-pre-line text-[13px] leading-relaxed text-ink/70">
          {block}
        </p>
      ))}
    </div>
  );
}
