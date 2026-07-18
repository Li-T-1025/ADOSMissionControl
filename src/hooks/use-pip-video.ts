/**
 * @module hooks/use-pip-video
 * @description An ISOLATED WHEP player for the cockpit picture-in-picture inset.
 * The main cockpit feed runs through the module-global singleton peer connection
 * (`video/webrtc/session-state`), so a second live feed needs its own connection
 * that never touches those globals. This hook owns a private `RTCPeerConnection`
 * per PiP `whepUrl`, mirrors the main WHEP SDP exchange (recv-only transceivers +
 * low-latency receiver hints, offer → ICE gather → POST → answer → ontrack), and
 * attaches the resulting stream to the passed `<video>` element. It writes no
 * shared state and polls no stats — a naive second `startStream()` would tear
 * down the main feed.
 *
 * Only the `concurrent` switch mechanism (N addressable WHEP paths) supports PiP;
 * a single-encoder `switchable` node has just one live stream. Exercised on a
 * real multi-stream node (a smart pod); in demo mode the inset uses the
 * synthetic canvas feed instead of this hook.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";

import {
  LAN_ICE_GATHER_TIMEOUT_MS,
  LAN_ONTRACK_TIMEOUT_MS,
} from "@/lib/video/webrtc-constants";

/**
 * Drive a `<video>` element from a WHEP endpoint with a private peer connection.
 * A null `whepUrl` (or unmount) tears the connection down. Independent of the
 * main cockpit video session.
 */
export function usePipVideo(
  whepUrl: string | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
): void {
  useEffect(() => {
    if (!whepUrl) return;
    // The inset's <video> is stable for the effect's life; capture it once so
    // the async attach and the cleanup act on the same element.
    const videoEl = videoRef.current;
    const controller = new AbortController();
    const { signal } = controller;
    let pc: RTCPeerConnection | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        const newPc = new RTCPeerConnection({ iceServers: [] });
        pc = newPc;
        const videoTransceiver = newPc.addTransceiver("video", {
          direction: "recvonly",
        });
        try {
          const recv = videoTransceiver.receiver as RTCRtpReceiver & {
            playoutDelayHint?: number;
            jitterBufferTarget?: number;
          };
          if ("playoutDelayHint" in recv) recv.playoutDelayHint = 0;
          if ("jitterBufferTarget" in recv) recv.jitterBufferTarget = 50;
        } catch {
          // Browser without the receiver-side hint API — use its defaults.
        }
        newPc.addTransceiver("audio", { direction: "recvonly" });

        const stream = new Promise<MediaStream>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("pip: no video track")),
            LAN_ONTRACK_TIMEOUT_MS,
          );
          newPc.ontrack = (event) => {
            if (event.streams[0]) {
              clearTimeout(timeout);
              resolve(event.streams[0]);
            }
          };
        });

        const offer = await newPc.createOffer();
        if (signal.aborted) return;
        await newPc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          if (newPc.iceGatheringState === "complete") return resolve();
          const check = () => {
            if (newPc.iceGatheringState === "complete") {
              newPc.removeEventListener("icegatheringstatechange", check);
              resolve();
            }
          };
          newPc.addEventListener("icegatheringstatechange", check);
          setTimeout(resolve, LAN_ICE_GATHER_TIMEOUT_MS);
        });
        if (signal.aborted) return;

        const response = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: newPc.localDescription!.sdp,
          signal,
        });
        if (!response.ok) throw new Error(`pip WHEP ${response.status}`);
        const answerSdp = await response.text();
        if (signal.aborted) return;
        await newPc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        const media = await stream;
        if (cancelled || signal.aborted) return;
        if (videoEl) videoEl.srcObject = media;
      } catch {
        // A failed PiP inset is non-fatal — the main feed is unaffected.
      }
    };
    void start();

    return () => {
      cancelled = true;
      controller.abort();
      if (videoEl) videoEl.srcObject = null;
      if (pc) {
        try {
          pc.getReceivers().forEach((r) => r.track?.stop());
          pc.close();
        } catch {
          // already closed
        }
      }
    };
  }, [whepUrl, videoRef]);
}
