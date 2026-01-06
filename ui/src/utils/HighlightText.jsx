// Helper function to highlight text with search keywords
export function highlightText(text, searchQuery) {
    if (!text || !searchQuery || searchQuery.trim() === "") {
        return text;
    }

    const keywords = searchQuery.trim().split(/\s+/).filter(k => k.length > 0);
    if (keywords.length === 0) {
        return text;
    }

    // a case-insensitive regex that matches all keywords
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
        // Add highlighted match
        parts.push(<mark key={`highlight-${keyCounter++}`} className="search-highlight">{match[0]}</mark>);
        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts;
}