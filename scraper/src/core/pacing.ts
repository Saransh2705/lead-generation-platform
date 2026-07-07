export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const jitter = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
// Human-ish pause between requests to one source.
export const pace = (minMs: number, maxMs: number) => sleep(jitter(minMs, maxMs));
