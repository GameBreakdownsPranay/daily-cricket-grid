const BASE_URL = import.meta.env.VITE_API_URL;

export async function fetchGrid() {
  const response = await fetch(`${BASE_URL}/grid`);

  if (!response.ok) {
    throw new Error("Grid fetch failed");
  }

  return response.json();
}