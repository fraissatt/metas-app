/** First letter of the first two words of a name, upper-cased ("ana maria silva" -> "AM"). */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
  return letters ? letters.toLocaleUpperCase('pt-BR') : '?'
}
