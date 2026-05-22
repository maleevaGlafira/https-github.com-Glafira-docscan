export function postProcessText(text: string): string {
  // 1. Correct common OCR mistakes
  let processedText = correctOcrMistakes(text);

  // 2. Format paragraphs
  // Split by newlines, trim lines, remove empty lines
  const lines = processedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // 3. Rebuild with 3 spaces before
  const paragraphs = lines.map(line => '   ' + line);
  
  return paragraphs.join('\n');
}

function correctOcrMistakes(text: string): string {
  const dictionary: Record<string, string> = {
    // English typical errors
    ' l ': ' I ',
    ' rn ': ' m ',
    ' cl ': ' d ',
    ' 0': ' O',
    ' lnt': ' Int',
    // Russian typical errors
    ' ь ': ' ъ ',
    ' ш ': ' щ ',
    ' rд ': ' гд ',
    // Ukrainian typical errors
    ' і ': ' 1 ', // Often confused in other direction but we just give an example
    ' ї ': ' i ', // Sometimes 
  };

  let corrected = text;

  // We can do a rudimentary pass for common punctuation errors
  corrected = corrected.replace(/ ,/g, ',');
  corrected = corrected.replace(/ \./g, '.');
  corrected = corrected.replace(/ ;/g, ';');
  corrected = corrected.replace(/ :/g, ':');
  
  // Fix multiple spaces
  corrected = corrected.replace(/[ ]{2,}/g, ' ');

  // Apply basic dictionary
  for (const [wrong, right] of Object.entries(dictionary)) {
    // we use simple replace all for exact matches.
    // In a real advanced app we would use NLP or hunspell, but here we do simplistic approach
    corrected = corrected.split(wrong).join(right); 
  }

  return corrected;
}
