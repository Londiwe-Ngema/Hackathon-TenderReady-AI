import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: class {
    send = vi.fn(async () => ({ Parameter: { Value: "test-token" } }));
  },
  GetParameterCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { buildTurns, extractJson } from "../src/lib/llm/messages";
import { modelOptions, workersAiProvider } from "../src/lib/llm/workers-ai";

describe("buildTurns", () => {
  it("starts with a user turn, merges repeats and ends with the question", () => {
    const turns = buildTurns(
      [
        { role: "assistant", text: "orphan" },
        { role: "user", text: "a" },
        { role: "user", text: "b" },
        { role: "assistant", text: "c" },
        { role: "user", text: "dangling" },
      ],
      "q",
    );
    expect(turns).toEqual([
      { role: "user", text: "a\n\nb" },
      { role: "assistant", text: "c" },
      { role: "user", text: "q" },
    ]);
  });
});

describe("extractJson", () => {
  it("handles plain, fenced and prose-wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Here you go: {"a":3} hope that helps')).toEqual({ a: 3 });
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("modelOptions", () => {
  it("keeps reasoning short per model family", () => {
    expect(modelOptions("@cf/zai-org/glm-4.7-flash")).toEqual({ chat_template_kwargs: { enable_thinking: false } });
    expect(modelOptions("@cf/openai/gpt-oss-120b")).toEqual({ reasoning_effort: "low" });
    expect(modelOptions("@cf/mistralai/mistral-small-3.1-24b-instruct")).toEqual({});
  });
});

describe("workersAiProvider", () => {
  const fetchMock = vi.fn();
  const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }), { status: 200 });
  const req = { system: "sys", document: "<page number=\"1\">x</page>", instruction: "do it", schemaName: "rec", schema: { type: "object" }, maxTokens: 100 };

  beforeEach(() => {
    process.env.CF_ACCOUNT_ID = "acct123";
    process.env.CF_TOKEN_PARAM = "/p";
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("calls the OpenAI-compatible endpoint with the token, document, JSON mode and the schema in the prompt", async () => {
    fetchMock.mockResolvedValueOnce(ok('{"summary":{}}'));
    const out = await workersAiProvider("@cf/test/model").structured(req);
    expect(out).toEqual({ summary: {} });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("@cf/test/model");
    expect(body.messages[0].content).toContain("<document>");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content).toContain('{"type":"object"}');
  });

  it("retries without a format constraint when JSON mode is rejected", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unsupported", { status: 400 })).mockResolvedValueOnce(ok("```json\n{\"ok\":true}\n```"));
    expect(await workersAiProvider("m").structured(req)).toEqual({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).response_format).toBeUndefined();
  });

  it("salvages complete items from an answer cut off at the output limit", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"checklist":[{"a":1},{"a":2},{"a":' }, finish_reason: "length" }] }), { status: 200 }),
    );
    expect(await workersAiProvider("m").structured(req)).toEqual({ checklist: [{ a: 1 }, { a: 2 }] });
  });

  it("explains an exhausted daily allowance and marks plain 429s as retryable throttling", async () => {
    fetchMock.mockResolvedValueOnce(new Response("you have used up your daily free allocation of neurons", { status: 429 }));
    await expect(workersAiProvider("m").chat({ ...req, messages: [{ role: "user", text: "q" }], temperature: 0 })).rejects.toMatchObject({
      name: "UserFacingError",
    });
    fetchMock.mockResolvedValueOnce(new Response("slow down", { status: 429 }));
    await expect(workersAiProvider("m").chat({ ...req, messages: [{ role: "user", text: "q" }], temperature: 0 })).rejects.toMatchObject({
      name: "ThrottlingException",
    });
  });
});
