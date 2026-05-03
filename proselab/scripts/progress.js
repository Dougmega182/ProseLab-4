/**
 * SIMPLE CLI PROGRESS BAR
 */

export function renderProgressBar(current, total, label = "Progress") {
  const size = 30;
  const percentage = Math.round((current / total) * 100);
  const filledSize = Math.round((current / total) * size);
  const emptySize = size - filledSize;

  const bar = "█".repeat(filledSize) + "░".repeat(emptySize);
  
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`${label}: [${bar}] ${percentage}% (${current}/${total})`);
  
  if (current === total) {
      process.stdout.write("\n");
  }
}
