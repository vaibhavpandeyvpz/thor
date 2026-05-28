---
name: flash-samsung-phone
description: Use when guiding or executing Samsung Download/ODIN Mode firmware flashing. Uses thorjs for all device operations including device discovery, doctor checks, firmware planning, ODIN/LOKE handshake testing, live flashing, PIT/repartition options.
---

# flash-samsung-phone

Use this skill when an agent needs to guide or execute Samsung Download Mode workflows with `thorjs`.

## Purpose

This skill standardizes safe, reproducible Samsung flashing flows and prevents unsafe sequencing mistakes.

## Critical Device Session Constraint

Samsung Download Mode supports only **one ODIN/LOKE handshake per boot into Download Mode** for this workflow.

After running any device-contacting command, including:

- `thorjs handshake`
- `thorjs flash` in live mode
- PIT read/write flows through interactive mode
- any command path that opens the serial transport and sends `ODIN`

assume the handshake budget is consumed for that boot.

The device must be rebooted back into Download Mode before any additional device-contacting operation.

Non-device commands such as `thorjs devices`, `thorjs doctor` without `--port`, and `thorjs plan` do not consume handshake session state.

## Agent Behavior Rules

1. Always start with planning and environment checks (`devices`, `doctor`, `plan`) before live flash.
2. For `flash`, default to dry-run unless explicit user authorization is provided for live flashing.
3. Explicitly restate risky flags (`--repartition`, `--pit`, `--nand-erase`) and their dependencies.
4. Refuse ambiguous destructive sequences until the user confirms exact intent.
5. After any device-contacting step, remind the user to reboot back to Download Mode before the next device command.
6. Clearly label whether each command contacts the device.
7. Tailor examples only by changing package paths and serial ports.

## Output Checklist

When helping users, produce:

- selected workflow: diagnose, plan, handshake test, or live flash
- exact command or commands
- platform-adjusted path and port notes
- whether the command contacts the device
- whether reboot-to-Download-Mode is required next

## Command Matrix

### `thorjs devices`

Purpose: enumerate serial ports and likely Odin candidates.

This does not contact the device through the ODIN/LOKE protocol and does not consume the one-handshake session.

Examples:

```bash
npx thorjs@latest devices
npx thorjs@latest devices --json
```

### `thorjs doctor`

Purpose: preflight checks for Node.js version, serial enumeration, and optionally port open/close permissions.

Examples:

```bash
npx thorjs@latest doctor
npx thorjs@latest doctor --port COM9
npx thorjs@latest doctor --port /dev/ttyACM0
npx thorjs@latest doctor --port /dev/cu.usbmodem1234
```

`doctor` without `--port` does not contact the device. `doctor --port` opens the serial port for a permission check; treat it as device-touching and ask the user to reboot back into Download Mode before later `handshake` or live `flash` steps.

### `thorjs plan <packages...>`

Purpose: inspect firmware packaging and transfer size without device contact.

Examples:

```bash
npx thorjs@latest plan AP.tar.md5
npx thorjs@latest plan BL.tar.md5 AP.tar.md5 CP.tar.md5 CSC.tar.md5
npx thorjs@latest plan boot.img.lz4 modem.bin.gz
```

### `thorjs handshake --port <path>`

Purpose: one-shot ODIN/LOKE connectivity verification.

This contacts the device and consumes the one-handshake session for the current Download Mode boot. After success or failure, the phone must be rebooted back into Download Mode before another device command.

Examples:

```bash
npx thorjs@latest handshake --port COM9
npx thorjs@latest handshake --port /dev/ttyACM0
npx thorjs@latest handshake --port /dev/cu.usbmodem1234
```

### `thorjs flash [options]`

Purpose: guarded flashing entry point.

Slot options:

- `--bl <path>`: BL slot package
- `--ap <path>`: AP slot package
- `--cp <path>`: CP slot package
- `--csc <path>`: CSC slot package
- `--userdata <path>`: USERDATA slot package

Device and behavior options:

- `--port <path>`: serial port path
- `--f-reset-time`: enable firmware reset-time command
- `--reboot`: reboot device after flash
- `--i-understand-this-can-brick`: required for live device contact

PIT and repartition options:

- `--pit <path>`: PIT file path; requires `--repartition`
- `--repartition`: upload PIT to device before flashing; requires `--pit`
- `--nand-erase`: erase NAND/userdata; requires both `--pit` and `--repartition`

## Flash Examples

### Dry Plan Mode

If `--i-understand-this-can-brick` is omitted, `flash` computes a plan and does not contact the device.

```bash
npx thorjs@latest flash --ap AP.tar.md5 --port COM9
```

```bash
npx thorjs@latest flash \
  --bl BL.tar.md5 \
  --ap AP.tar.md5 \
  --cp CP.tar.md5 \
  --csc CSC.tar.md5 \
  --port /dev/ttyACM0
```

### Minimal Live Flash

This contacts the device and consumes the current Download Mode handshake session.

```bash
npx thorjs@latest flash \
  --ap AP.tar.md5 \
  --port /dev/ttyACM0 \
  --i-understand-this-can-brick
```

### Common Four-Slot Live Flash

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

### Four-Slot Flash With USERDATA

```bash
npx thorjs@latest flash \
  --bl BL.tar.md5 \
  --ap AP.tar.md5 \
  --cp CP.tar.md5 \
  --csc CSC.tar.md5 \
  --userdata USERDATA.tar.md5 \
  --port COM9 \
  --reboot \
  --i-understand-this-can-brick
```

### Live Flash With Firmware Reset-Time Command

```bash
npx thorjs@latest flash \
  --ap AP.tar.md5 \
  --port /dev/cu.usbmodem1234 \
  --f-reset-time \
  --i-understand-this-can-brick
```

### Repartition With PIT Upload

This is dangerous. Confirm the PIT file exactly matches the device model and intended partition layout.

```bash
npx thorjs@latest flash \
  --ap AP.tar.md5 \
  --pit device.pit \
  --repartition \
  --port /dev/ttyACM0 \
  --i-understand-this-can-brick
```

### Repartition With NAND Erase

This is high risk and destructive. It requires both `--pit` and `--repartition`.

```bash
npx thorjs@latest flash \
  --ap AP.tar.md5 \
  --pit device.pit \
  --repartition \
  --nand-erase \
  --port COM9 \
  --i-understand-this-can-brick
```

After any live flash attempt, reboot back into Download Mode before another device operation.

## Valid and Invalid Option Combinations

Slot package options:

- Valid: any subset of `--bl`, `--ap`, `--cp`, `--csc`, `--userdata`
- Invalid: none provided

Device authorization gate:

- Valid dry plan: omit `--i-understand-this-can-brick`
- Valid live contact: include `--i-understand-this-can-brick`
- Invalid live attempt: user expects flashing but omits `--i-understand-this-can-brick`

PIT, repartition, and NAND erase:

- Valid: `--pit device.pit --repartition`
- Valid: `--pit device.pit --repartition --nand-erase`
- Invalid: `--repartition` without `--pit`
- Invalid: `--pit` without `--repartition`
- Invalid: `--nand-erase` without both `--pit` and `--repartition`

Optional toggles:

- `--f-reset-time` may be combined with any valid live flash command
- `--reboot` may be combined with any valid live flash command

## Practical Workflow Templates

### Safe Staged Workflow

1. Run `npx thorjs@latest devices`.
2. Run `npx thorjs@latest doctor`.
3. Run `npx thorjs@latest plan BL.tar.md5 AP.tar.md5 CP.tar.md5 CSC.tar.md5`.
4. Boot the phone into Download Mode.
5. Run one device operation: either `handshake` or live `flash`.
6. Reboot the phone back into Download Mode before any next device operation.

### Handshake-First Workflow

1. Boot the phone into Download Mode.
2. Run `npx thorjs@latest handshake --port <PORT>`.
3. Reboot the phone into Download Mode again.
4. Run the live `flash` command.

### Direct Live-Flash Workflow

1. Run `devices`, `doctor`, and `plan`.
2. Boot the phone into Download Mode.
3. Run the live `flash` command.
4. Re-enter Download Mode before any later device command.

## Platform Port Examples

- Windows: `COM9`
- Linux: `/dev/ttyACM0`
- macOS: `/dev/cu.usbmodem1234`
