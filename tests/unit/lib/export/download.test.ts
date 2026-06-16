// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadFile } from "@/lib/export/download";

describe("downloadFile", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let lastAnchor: HTMLAnchorElement | null;

  beforeEach(() => {
    lastAnchor = null;

    createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fake-url");
    revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    clickSpy = vi.fn();
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      ((tag: string) => {
        const el = original(tag) as HTMLElement;
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          anchor.click = clickSpy as unknown as HTMLAnchorElement["click"];
          lastAnchor = anchor;
        }
        return el;
      }) as typeof document.createElement,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a Blob with the right content and MIME type", () => {
    downloadFile("hello world", "test.txt", "text/plain");

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/plain");
    expect(blob.size).toBe("hello world".length);
  });

  it("triggers a download by clicking an anchor with the right filename and href", () => {
    downloadFile("payload", "data.json", "application/json");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(lastAnchor).not.toBeNull();
    expect(lastAnchor?.download).toBe("data.json");
    expect(lastAnchor?.href).toBe("blob:fake-url");
  });

  it("revokes the object URL after the download is triggered", () => {
    downloadFile("x", "x.txt", "text/plain");

    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
  });
});
