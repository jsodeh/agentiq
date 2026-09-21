// Quick test to diagnose parser against exact DB content
const content = `\`\`\`json
{
  "reasoning": "The initial Google Maps query yielded 0 results. Executing a web search for popular restaurants, eateries, and spots in Ogudu GRA, Lagos, to gather reliable, real-world recommendations.",
  "expected_outcome": "A list of popular restaurants and dining spots in and around Ogudu GRA, Lagos.",
  "actions": [
    {
      "tool": "web_search",
      "params": {
        "query": "top restaurants in Ogudu GRA Lagos Nigeria"
      },
      "description": "Web search for popular restaurants and food spots in Ogudu GRA, Lagos."
    }
  ]
}
\`\`\`

`;

console.log("=== RAW CONTENT ===");
console.log(JSON.stringify(content));
console.log("\n=== TRIMMED ===");
const trimmed = content.trim();
console.log(JSON.stringify(trimmed));

// Test fence extraction
const fenceStart = trimmed.indexOf("```json");
console.log("\nfence_start index:", fenceStart);

const afterFence = trimmed.slice(fenceStart + 7);
console.log("after_fence starts_with:", JSON.stringify(afterFence.slice(0, 5)));

// Skip newline
const contentStart = afterFence.startsWith('\n') ? afterFence.slice(1) : afterFence;
console.log("content_start first 20:", JSON.stringify(contentStart.slice(0, 20)));

// rfind closing ```
const lastFenceIdx = contentStart.lastIndexOf("```");
console.log("lastFenceIdx:", lastFenceIdx);
console.log("content_start length:", contentStart.length);

const inner = contentStart.slice(0, lastFenceIdx).trim();
console.log("\n=== EXTRACTED JSON ===");
console.log(inner.slice(0, 100));
console.log("\n=== PARSE RESULT ===");
try {
  const parsed = JSON.parse(inner);
  console.log("SUCCESS - actions:", parsed.actions?.length);
} catch(e) {
  console.log("PARSE FAILED:", e);
}
