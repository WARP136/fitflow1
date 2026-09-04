/*
 * Barcode scanning. Two decoders, no npm dependency either way:
 *
 * 1. BarcodeDetector, the native one, where it exists. Hardware-accelerated,
 *    reads formats we never could (Code 128, QR), zero bundle cost.
 * 2. Otherwise services/ean.js, our own EAN-13/UPC-A/EAN-8 reader.
 *
 * The fallback isn't an edge case, it's the main path on the machine this
 * was built on - BarcodeDetector is missing entirely on Chrome and Edge for
 * Windows. "Use Chrome" was advice that could never work.
 *
 * If this ever misbehaves:
 *  - getUserMedia needs a secure context. localhost counts, a plain http
 *    LAN address does not.
 *  - decoding is throttled rather than run per frame. That's the difference
 *    between a warm laptop and a loud one.
 *  - resolution is load-bearing. 95 modules wide at ~2.7px per module means
 *    a frame under ~1280px can't resolve a barcode held at a comfortable
 *    distance, however good the decoder. We ask for 1920 and pass the frame
 *    through unscaled. See the note above createDecoder in ean.js.
 */

import { createDecoder } from './ean.js'

const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']

/** What this browser can actually do, so the UI can be specific about it. */
export function scanSupport() {
  const native = typeof window !== 'undefined' && 'BarcodeDetector' in window
  const camera = !!navigator?.mediaDevices?.getUserMedia
  const secure = typeof window !== 'undefined' ? window.isSecureContext : false
  return {
    native,
    // Kept under the old name too: `detector` now means "something can decode",
    // which is always true, rather than "the browser can".
    detector: true,
    camera,
    secure,
    ok: camera && secure,
    // Which engine will actually run, for the page to say out loud.
    engine: native ? 'browser' : 'built-in',
    // One honest sentence, rather than making the page assemble it.
    reason: !camera
      ? 'This browser won’t give a page camera access.'
      : !secure
        ? 'The camera only works over https or on localhost.'
        : '',
  }
}

/** Strip everything that is not a digit. Labels are printed with spaces. */
export const cleanCode = (s) => String(s || '').replace(/\D+/g, '')

/** EAN/UPC lengths. Anything else is a typo, not a product. */
export const isLikelyCode = (s) => {
  const n = cleanCode(s).length
  return n === 8 || n === 12 || n === 13 || n === 14
}

/*
 * Point the camera at a label and call onFound(code) once.
 *
 * Resolves to a stop() function. Always call it: a camera nobody stopped keeps
 * the recording light on, which is alarming.
 *
 * @param {{ video: HTMLVideoElement, onFound: (code:string)=>void,
 *           onError?: (msg:string)=>void,
 *           onStatus?: (s:{frames:number,size:string})=>void,
 *           interval?: number }} opts - leave interval unset to let each
 *   decoder pick its own throttle. onStatus fires every frame examined, so the
 *   page can show that something is actually happening.
 */
export async function startScan({ video, onFound, onError, onStatus, interval }) {
  const support = scanSupport()
  if (!support.ok) {
    onError?.(support.reason)
    return () => {}
  }

  let stream = null
  let timer = null
  let stopped = false

  const stop = () => {
    stopped = true
    clearTimeout(timer)
    if (stream) stream.getTracks().forEach((t) => t.stop())
    if (video) video.srcObject = null
  }

  try {
    /* Resolution is not a nicety here, it is the difference between working and
       not. The decoder needs about 2.7 pixels per module and an EAN-13 is 95
       modules, so a barcode filling a fifth of the frame needs ~1280px of frame
       to be legible at all and 1920 to be legible comfortably. Cameras hand out
       640x480 by default if you do not ask, which is unreadable at any framing
       a person would naturally use. `ideal` rather than `exact` so a webcam that
       cannot manage it still starts, at whatever it can do.

       facingMode is asked for only on touch devices. On a phone 'environment'
       is the rear camera and obviously right; on a Windows laptop it matches
       nothing, and asking for a camera that does not exist is how you end up
       being handed the infrared Windows Hello sensor instead of the webcam. */
    const wantsRear =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(wantsRear ? { facingMode: 'environment' } : null),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })
    if (stopped) {
      stream.getTracks().forEach((t) => t.stop())
      return stop
    }
    video.srcObject = stream
    await video.play()
  } catch (err) {
    // Overwhelmingly this is the user clicking Block, so say that plainly
    // instead of printing a DOMException at them.
    onError?.(
      err?.name === 'NotAllowedError'
        ? 'Camera access was blocked. You can still type the number in.'
        : err?.name === 'NotFoundError'
          ? 'No camera found on this machine.'
          : 'The camera wouldn’t start. Typing the number works just as well.'
    )
    stop()
    return stop
  }

  /* --- Pick a decoder --- */
  let detector = null
  if (support.native) {
    // Ask for only the formats this build of the browser admits to supporting;
    // passing an unsupported format to the constructor throws.
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      const formats = WANTED.filter((f) => supported.includes(f))
      detector = new window.BarcodeDetector(formats.length ? { formats } : undefined)
    } catch {
      try {
        detector = new window.BarcodeDetector()
      } catch {
        detector = null // claimed to exist, refused to build: fall through to JS
      }
    }
  }
  const js = detector ? null : createDecoder()

  /* The native decoder cross-checks internally, so one hit is enough. Our own
     reader has no second opinion, so it must see the same number on two
     separate frames before believing it - about a third of a second, and the
     difference between "scanned it" and "scanned something". */
  const needed = detector ? 1 : 2
  let last = null
  let seen = 0
  let frames = 0

  const accept = (raw) => {
    const code = cleanCode(raw)
    if (!isLikelyCode(code)) return false
    seen = code === last ? seen + 1 : 1
    last = code
    if (seen < needed) return false
    onFound(code)
    stop() // one read is the whole job; stop the camera immediately
    return true
  }

  // Our decoder reads a couple of dozen thin scanlines rather than a whole
  // frame, so it can look more often than the native one. Both stay well clear
  // of the animation frame budget.
  const wait = interval ?? (detector ? 280 : 140)

  const tick = async () => {
    if (stopped) return
    try {
      if (video.readyState >= 2) {
        if (detector) {
          const hits = await detector.detect(video)
          frames++
          const hit = hits?.find((h) => isLikelyCode(h.rawValue))?.rawValue
          if (hit && accept(hit)) return
        } else {
          const hit = js.decode(video)
          frames = js.frames
          if (hit && accept(hit)) return
        }
        /* Reported every frame so the page can prove it is looking. "The camera
           isn't searching" was a reasonable thing to conclude from a live video
           feed and no other feedback whatsoever - the frame counter and the
           negotiated resolution together say both that it is working and, if
           the camera came back at 640x480, why it will not find anything. */
        onStatus?.({
          frames,
          size: detector ? `${video.videoWidth}×${video.videoHeight}` : js.size,
        })
      }
    } catch {
      /* A single failed frame is normal - motion blur, no light. Keep going. */
    }
    timer = setTimeout(tick, wait)
  }
  tick()

  return stop
}
