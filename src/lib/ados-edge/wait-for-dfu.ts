/**
 * @module ados-edge/wait-for-dfu
 * @description Poll `navigator.usb.getDevices()` for an STM32 ROM DFU
 * device after the radio has been asked to reboot into its bootloader.
 * Returns the first matching `USBDevice` or throws on timeout.
 *
 * The radio uses the stock STM32 DFU VID:PID (`0x0483:0xdf11`) once in
 * bootloader mode. WebUSB will only return devices that the browser has
 * previously granted this origin; if nothing matches, the caller should
 * fall back to `usbDeviceManager.requestDevice()` to prompt the user.
 *
 * @license GPL-3.0-only
 */

/// <reference path="../protocol/web-usb.d.ts" />

const STM32_DFU_VID = 0x0483;
const STM32_DFU_PID = 0xdf11;

export interface WaitForDfuOptions {
  /** Total time to wait in ms. Default 10000. */
  timeoutMs?: number;
  /** Poll interval in ms. Default 500. */
  pollIntervalMs?: number;
  /** Abort signal to cancel the wait early. */
  signal?: AbortSignal;
}

export class DfuWaitTimeoutError extends Error {
  constructor(message = "Timed out waiting for DFU device") {
    super(message);
    this.name = "DfuWaitTimeoutError";
  }
}

export class DfuWaitAbortedError extends Error {
  constructor(message = "DFU wait cancelled") {
    super(message);
    this.name = "DfuWaitAbortedError";
  }
}

function isStm32Dfu(device: USBDevice): boolean {
  if (device.vendorId === STM32_DFU_VID && device.productId === STM32_DFU_PID) {
    return true;
  }
  if (!device.configuration) return false;
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      if (alt.interfaceClass === 0xfe && alt.interfaceSubclass === 0x01) {
        return true;
      }
    }
  }
  return false;
}

export async function findStm32DfuDevice(): Promise<USBDevice | null> {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    return null;
  }
  try {
    const devices = await navigator.usb.getDevices();
    return devices.find((d) => isStm32Dfu(d)) ?? null;
  } catch {
    return null;
  }
}

export async function waitForStm32DfuDevice(
  opts: WaitForDfuOptions = {},
): Promise<USBDevice> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) {
      throw new DfuWaitAbortedError();
    }
    const device = await findStm32DfuDevice();
    if (device) return device;
    await sleep(pollIntervalMs, opts.signal);
  }
  throw new DfuWaitTimeoutError();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DfuWaitAbortedError());
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DfuWaitAbortedError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
