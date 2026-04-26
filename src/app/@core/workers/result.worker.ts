/// <reference lib="webworker" />

// Returns true if the object has at least one property with a non-empty value
function hasValues(obj: any) {
  return Object.values(obj).every(
    (value) => value !== null && value !== undefined && value !== ''
  );
}

// --------------------- WORKER MESSAGE HANDLER ---------------------
addEventListener('message', async ({ data }) => {
  try {
    const results = [];
    for (const row of data) {
      if (hasValues(row)) results.push(row);
    }
    postMessage(results);
  } catch (err) {
    postMessage({ error: (err as Error).message });
  }
});
