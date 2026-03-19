export async function fetchGrid() {
  const response = await fetch("/grid");

  if (!response.ok) {
    throw new Error("Grid fetch failed");
  }

  const data = await response.json();

  return data;
}