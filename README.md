# thorjs

[![npm version](https://img.shields.io/npm/v/thorjs.svg)](https://www.npmjs.com/package/thorjs)
[![npm downloads](https://img.shields.io/npm/dm/thorjs.svg)](https://www.npmjs.com/package/thorjs)
[![GitHub Actions](https://github.com/vaibhavpandeyvpz/thor/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/vaibhavpandeyvpz/thor/actions/workflows/publish-npm.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`thorjs` is a command-line tool for quickly flashing Samsung firmware over a serial
download-mode connection.

It is designed to be:

- scriptable (`npx` and CI-friendly)
- conservative by default
- explicit about destructive operations

## Features

- Flash slot packages: `BL`, `AP`, `CP`, `CSC`, `USERDATA`
- Optional PIT upload with repartition
- Optional NAND erase (requires PIT + repartition)
- Optional firmware reset-time command
- Optional reboot after flash
- Device discovery and preflight checks
- Firmware planning without contacting a device

## Requirements

- Node.js `>=20`
- A Samsung device in Download Mode
- Working serial driver/permissions so the device appears as a serial port
  - Windows: typically `COMx`
  - Linux: typically `/dev/ttyACM*`
  - macOS: typically `/dev/cu.*`

## Quick Start (npx)

Start the guided interactive UI:

```bash
npx thorjs@latest
```

Interactive mode groups common workflows into two tabs:

- `Flash`: plan firmware packages or run the guarded flash wizard.
- `Utilities`: list devices, test handshake, read PIT, or troubleshoot setup.

Use non-interactive commands when scripting or automating:

```bash
npx thorjs@latest devices
npx thorjs@latest doctor
npx thorjs@latest doctor --port COM9
```

Flash examples:

Windows (`COMx`):

```powershell
npx thorjs@latest flash `
  --bl BL.tar.md5 `
  --ap AP.tar.md5 `
  --cp CP.tar.md5 `
  --csc CSC.tar.md5 `
  --port COM9 `
  --reboot `
  --i-understand-this-can-brick
```

Linux (`/dev/ttyACM*`):

```bash
npx thorjs@latest flash \
  --bl BL.tar.md5 \
  --ap AP.tar.md5 \
  --cp CP.tar.md5 \
  --csc CSC.tar.md5 \
  --port /dev/ttyACM0 \
  --reboot \
  --i-understand-this-can-brick
```

macOS (`/dev/cu.*`):

```bash
npx thorjs@latest flash \
  --bl BL.tar.md5 \
  --ap AP.tar.md5 \
  --cp CP.tar.md5 \
  --csc CSC.tar.md5 \
  --port /dev/cu.usbmodem1234 \
  --reboot \
  --i-understand-this-can-brick
```

## Install from Source

```bash
npm install
npm run build
```

Run locally:

```bash
node dist/src/cli.js --help
```

## CLI surface

The sections below describe the current CLI commands and options.

### `thorjs --help`

```text
Usage: thorjs [options] [command]

Samsung Odin/Loke flashing toolkit

Options:
  -V, --version          output the version number
  -h, --help             display help for command

Commands:
  devices [options]      List serial devices with Odin-focused hints
  doctor [options]       Run cross-platform environment and serial preflight checks
  plan <packages...>     Inspect one or more firmware packages without contacting a device
  handshake [options]    Open a device and perform only ODIN/LOKE handshake
  flash [options]        Guarded flashing entry point. This is intentionally conservative.
  help [command]         display help for command
```

### `thorjs devices --help`

```text
Usage: thorjs devices [options]

List serial devices with Odin-focused hints

Options:
  --json      print raw JSON output
  -h, --help  display help for command
```

### `thorjs doctor --help`

```text
Usage: thorjs doctor [options]

Run cross-platform environment and serial preflight checks

Options:
  --port <path>  optional port to open/close as a permission check
  -h, --help     display help for command
```

### `thorjs plan --help`

```text
Usage: thorjs plan [options] <packages...>

Inspect one or more firmware packages without contacting a device

Options:
  -h, --help  display help for command
```

### `thorjs handshake --help`

```text
Usage: thorjs handshake [options]

Open a device and perform only ODIN/LOKE handshake

Options:
  --port <path>  serial port path, e.g. COM1 or \\.\COM1
  -h, --help     display help for command
```

### `thorjs flash --help`

```text
Usage: thorjs flash [options]

Guarded flashing entry point. This is intentionally conservative.

Options:
  --bl <path>                    BL slot package
  --ap <path>                    AP slot package
  --cp <path>                    CP slot package
  --csc <path>                   CSC slot package
  --userdata <path>              USERDATA slot package
  --pit <path>                   PIT file path (requires --repartition)
  --repartition                  Upload PIT to device before flashing (dangerous)
  --nand-erase                   Erase NAND/userdata before flashing (requires --pit and --repartition)
  --port <path>                  serial port path
  --f-reset-time                 enable firmware reset time command (disabled by default)
  --reboot                       reboot device after flash (disabled by default)
  --i-understand-this-can-brick  required to actually contact the device
  -h, --help                     display help for command
```

If `--i-understand-this-can-brick` is omitted, `flash` runs as a dry plan and
does not contact the device.

## Safety Notes

- Flashing can permanently brick devices.
- Use firmware that exactly matches your model/region.
- Use `thorjs plan`, `thorjs devices`, and `thorjs doctor` before live flashing.
- `--repartition` and `--nand-erase` are high risk; use only when required.

## Disclaimer

By using this project, you acknowledge that firmware flashing is inherently risky and may permanently damage or brick devices.

This software is provided "as is", without warranties or guarantees of any kind. The author and contributors cannot be held responsible or liable for any damage, data loss, warranty voidance, or other consequences resulting from use or misuse of this tool.

You assume full responsibility for all actions performed with `thorjs` and use it entirely at your own risk.
