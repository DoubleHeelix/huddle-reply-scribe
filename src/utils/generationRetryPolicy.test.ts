import { describe, expect, it, vi } from "vitest";
import {
  BASE_RETRY_DELAY_MS,
  RetryableGenerationError,
  runWithGenerationRetry,
} from "./generationRetryPolicy";

describe("runWithGenerationRetry", () => {
  it("returns immediately after a successful first attempt", async () => {
    const operation = vi.fn().mockResolvedValue("reply");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runWithGenerationRetry(operation, { sleep })
    ).resolves.toBe("reply");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries one 500 response after a backoff", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("Function Error: 500 Internal Server Error"))
      .mockResolvedValue("reply");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runWithGenerationRetry(operation, { sleep })
    ).resolves.toBe("reply");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(BASE_RETRY_DELAY_MS);
  });

  it("stops after two attempts when a 503 persists", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error("Function Error: 503 Service Unavailable"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runWithGenerationRetry(operation, { sleep })
    ).rejects.toThrow("503");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 403, 429])(
    "does not retry an HTTP %s response",
    async (status) => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error(`Function Error: ${status}`));
      const sleep = vi.fn().mockResolvedValue(undefined);

      await expect(
        runWithGenerationRetry(operation, { sleep })
      ).rejects.toThrow(String(status));
      expect(operation).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
  );

  it("retries a transient network failure once", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue("reply");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runWithGenerationRetry(operation, { sleep })
    ).resolves.toBe("reply");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries an empty or fallback generation once", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new RetryableGenerationError("Empty reply"))
      .mockResolvedValue("reply");

    await expect(
      runWithGenerationRetry(operation, {
        sleep: vi.fn().mockResolvedValue(undefined),
      })
    ).resolves.toBe("reply");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
