// Helper function to highlight text with search keywords
// Returns an array of JSX elements with <mark> tags around keywords
// If no match, returns original text string
export function highlightText(text, keywords) {
    if (!text || keywords.length === 0) {
        return text;
    }

    // A case-insensitive regex that matches all keywords
    const regexPattern = keywords
        .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

    const regex = new RegExp(`(${regexPattern})`, 'gi');
    const parts = [];
    let lastIndex = 0;
    let keyCounter = 0;

    // Find all matches and build JSX with highlights
    const matches = Array.from(text.matchAll(regex));

    for (const match of matches) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        // Determine if we add padding to word boundaries
        let styles = {}
        const charBefore = text[match.index - 1];
        if(!charBefore?.trim()) {
            styles.paddingLeft = '2px'
            styles.marginLeft = '-2px'
        }

        lastIndex = match.index + match[0].length;
        const charAfter = text[lastIndex];
        if(!charAfter?.trim()) {
            styles.paddingRight = '2px'
            styles.marginRight = '-2px'
        }

        // Add highlighted match
        parts.push(
            <mark key={`highlight-${keyCounter++}`} className="search-highlight" style={styles}>
                {match[0]}
            </mark>
        );
    }

    if(lastIndex === 0) {
        // No matches found, return original text without JSX
        return text;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts;
}

// Extract exceprt matching search keywords (lowercase assumed) and highlight them
// Returns JSX element with excerpt and highlights, or null if no match
export function extractExcerpt(fullText, keywords) {
  // Check if any keyword matches in metadata except name
  const fullTextLower = fullText.toLowerCase();

  // Find first match position to center excerpt around
  let firstMatchIndex = -1;
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const index = fullTextLower.indexOf(keywordLower);
    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index;
    }
  }

  if (firstMatchIndex === -1) {
    return null; // No matches found
  }

  // Extract excerpt centered around first match
  const excerptLength = 120;
  const start = Math.max(0, firstMatchIndex - (excerptLength / 2));
  const end = Math.min(fullText.length, start + excerptLength);
  let excerpt = fullText.substring(start, end);

  // Adjust to word boundaries if possible
  let prefixEllipsis = false;
  if (start > 0 && excerpt.length > 0) {
    prefixEllipsis = true;

    const firstSpace = excerpt.indexOf(" ");
    if (0 < firstSpace && firstSpace < 20) {
      excerpt = excerpt.substring(firstSpace + 1);
    }
  }

  let suffixEllipsis = false;
  if (end < fullText.length && excerpt.length > 0) {
    suffixEllipsis = true;

    const lastSpace = excerpt.lastIndexOf(" ");
    if (excerpt.length - 20 < lastSpace && lastSpace !== -1) {
      excerpt = excerpt.substring(0, lastSpace);
    }
  }

  // Use highlightText to highlight all keywords in the excerpt
  const highlightedExcerpt = highlightText(excerpt, keywords);

  return (
    <div className="metadata-excerpt">
      {prefixEllipsis && "... "}
      {highlightedExcerpt}
      {suffixEllipsis && "..."}
    </div>
  );
}