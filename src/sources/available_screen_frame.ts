import { replaceNaN, round, toFloat } from '../utils/data'
import { exitFullscreen, getFullscreenElement } from '../utils/browser'

// The order matches the CSS side order
export type FrameSize = [top: number | null, right: number | null, bottom: number | null, left: number | null]

const roundingPrecision = 10

let screenFrameBackup: FrameSize | undefined
let screenFrameSizeIntervalId: number | undefined

/**
 * Start watching the screen frame size. When it gets a non-zero size, it saves it and stops.
 * Later, when `getAvailableScreenFrame` is called, it will returns the saved non-zero size if the current size is null.
 *
 * This trick is required to mitigate the fact that the screen frame turns null in some cases.
 * See more on this at https://github.com/fingerprintjs/fingerprintjs/issues/568
 */
export function watchAvailableScreenFrame(): void {
  if (screenFrameSizeIntervalId === undefined) {
    screenFrameSizeIntervalId = (setInterval as typeof window.setInterval)(() => {
      const frameSize = getCurrentScreenFrame()
      if (!isFrameSizeNull(frameSize)) {
        screenFrameBackup = frameSize
        clearInterval(screenFrameSizeIntervalId)
      }
    }, 2500)
  }
}

export async function getAvailableScreenFrame(): Promise<FrameSize> {
  const frameSize = getCurrentScreenFrame()

  if (!isFrameSizeNull(frameSize)) {
    return frameSize
  }

  if (screenFrameBackup) {
    return screenFrameBackup
  }

  if (getFullscreenElement()) {
    // Some browsers set the screen frame to zero when programmatic fullscreen is on.
    // There is a chance of getting a non-zero frame after exiting the fullscreen.
    // See more on this at https://github.com/fingerprintjs/fingerprintjs/issues/568
    await exitFullscreen()
    return getCurrentScreenFrame()
  }

  return frameSize
}

/**
 * Sometimes the available screen resolution changes a bit for unknown reason, e.g. 1900x1440 → 1900x1439,
 * the rounding is used to mitigate this difference.
 */
export async function getRoundedAvailableScreenFrame(): Promise<FrameSize> {
  const processSize = (sideSize: FrameSize[number]) => (sideSize === null ? null : round(sideSize, roundingPrecision))
  const frameSize = await getAvailableScreenFrame()

  // It might look like I don't know about `for` and `map`.
  // In fact, such code is used to avoid TypeScript issues without using `as`.
  return [processSize(frameSize[0]), processSize(frameSize[1]), processSize(frameSize[2]), processSize(frameSize[3])]
}

function getCurrentScreenFrame(): FrameSize {
  const s = screen

  // Some browsers return screen resolution as strings, e.g. "1200", instead of a number, e.g. 1200.
  // I suspect it's done by certain plugins that randomize browser properties to prevent fingerprinting.
  return [
    replaceNaN(toFloat(s.availTop), null),
    replaceNaN(toFloat(s.width) - toFloat(s.availWidth) - toFloat(s.availLeft), null),
    replaceNaN(toFloat(s.height) - toFloat(s.availHeight) - toFloat(s.availTop), null),
    replaceNaN(toFloat(s.availLeft), null),
  ]
}

function isFrameSizeNull(frameSize: FrameSize) {
  for (let i = 0; i < 4; ++i) {
    if (frameSize[i]) {
      return false
    }
  }
  return true
}
