import { sanitizeReply } from "./replyFormatting.ts";

function assertEquals(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("preserves intentional reply line breaks", () => {
  const input = "First line.\nSecond line.\n\nSecond paragraph.";
  assertEquals(sanitizeReply(input, { trim: true }), input);
});

Deno.test("preserves newline-only streaming chunks", () => {
  assertEquals(sanitizeReply("\n\n"), "\n\n");
});

Deno.test("normalizes pasted line endings and excessive blank lines", () => {
  assertEquals(
    sanitizeReply("First.\r\n\r\n\r\nSecond.", { trim: true }),
    "First.\n\nSecond.",
  );
});

Deno.test("removes unsafe controls without joining paragraphs", () => {
  assertEquals(
    sanitizeReply("First.\u0007\n\nSecond.", { trim: true }),
    "First.\n\nSecond.",
  );
});
