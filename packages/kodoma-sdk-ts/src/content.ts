import type { AttachmentContent, ContentBuilder, ContentInput, CustomContent, TextContent } from "./types";

export function text(value: string): ContentBuilder {
  return {
    async build(): Promise<TextContent> {
      if (!value.trim()) throw new Error("text content cannot be empty");
      return { type: "text", text: value };
    }
  };
}

export function attachment(bytes: Uint8Array, options: { name: string; mimeType: string }): ContentBuilder {
  return {
    async build(): Promise<AttachmentContent> {
      if (!options.name.trim()) throw new Error("attachment name required");
      if (!options.mimeType.trim()) throw new Error("attachment mimeType required");
      return { type: "attachment", name: options.name, mimeType: options.mimeType, bytes };
    }
  };
}

export function custom(raw: unknown): ContentBuilder {
  return {
    async build(): Promise<CustomContent> {
      return { type: "custom", raw };
    }
  };
}

export async function resolveContents(items: readonly ContentInput[]) {
  const out = [];
  for (const item of items) {
    if (typeof item === "string") {
      out.push(await text(item).build());
    } else {
      out.push(await item.build());
    }
  }
  return out;
}
