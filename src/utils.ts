export function generateSteps(start: number, end: number, step: number) {
  const numbers: number[] = [];

  for (let i = start; i <= end; i += step) {
    numbers.push(i);
  }

  return numbers;
}