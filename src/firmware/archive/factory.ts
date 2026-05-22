import { Tar } from "./tar.js";
import { TarMd5 } from "./tar-md5.js";

export function createTar(path: string): Tar {
  if (/\.tar\.md5$/i.test(path)) {
    return new TarMd5(path);
  }
  if (/\.tar$/i.test(path)) {
    return new Tar(path);
  }
  throw new Error(`Unsupported archive format: ${path}`);
}

export function isTarArchive(path: string): boolean {
  return /\.(tar|tar\.md5)$/i.test(path);
}
