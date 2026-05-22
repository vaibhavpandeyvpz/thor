import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function fileRange(path: string, size: number): Promise<string> {
  const hash = createHash("md5");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path, { start: 0, end: size - 1 });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}
