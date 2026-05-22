export class CliIO {
  constructor(
    private readonly stdout: NodeJS.WriteStream = process.stdout,
    private readonly stderr: NodeJS.WriteStream = process.stderr,
  ) {}

  line(message: string): void {
    this.stdout.write(`${message}\n`);
  }

  error(message: string): void {
    this.stderr.write(`${message}\n`);
  }
}
