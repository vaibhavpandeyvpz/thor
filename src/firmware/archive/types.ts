export interface TarFileEntry {
  readonly name: string;
  readonly size: number;
  readonly dataOffset: number;
}

export interface TarMd5Info {
  readonly expected: string;
  readonly actual: string;
  readonly checksumSize: number;
  readonly tarSize: number;
}
