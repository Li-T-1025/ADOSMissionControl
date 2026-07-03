/**
 * Ambient types for `@mkkellogg/gaussian-splats-3d` (the package ships no
 * declarations). Only the surface the splat viewer uses is declared — the
 * self-driven `Viewer`, its construction options, and `addSplatScene`'s progress
 * callback. Kept minimal on purpose; extend when a new option is used.
 */
declare module "@mkkellogg/gaussian-splats-3d" {
  export interface ViewerOptions {
    /** Element the viewer builds its `<canvas>` into; sized to this element. */
    rootElement?: HTMLElement;
    /** Run the viewer's own render loop (default true); call `start()` to begin. */
    selfDrivenMode?: boolean;
    /** Attach built-in orbit controls (default true). */
    useBuiltInControls?: boolean;
    /** True renders at CSS resolution (DPR 1); false renders at the native
     * device pixel ratio (sharper on retina). */
    ignoreDevicePixelRatio?: boolean;
    /** GPU-accelerated depth sort of splats (default true). */
    gpuAcceleratedSort?: boolean;
    /** Use a `SharedArrayBuffer` for the sort worker — requires cross-origin
     * isolation (COOP/COEP). False works on any origin. */
    sharedMemoryForWorkers?: boolean;
    /** Whether splats can move after load (default false). */
    dynamicScene?: boolean;
    /** Spherical-harmonics degree to render: 0 = DC colour only, 1–2 add
     * view-dependent colour (needs the source to carry the coefficients). */
    sphericalHarmonicsDegree?: number;
  }

  export interface AddSplatSceneOptions {
    /** Let the viewer draw its own loading spinner (pass false to own it). */
    showLoadingUI?: boolean;
    /** Stream a coarse preview then refine — supported by the `.ksplat` format. */
    progressiveLoad?: boolean;
    /** Drop splats below this 0–255 alpha at load. */
    splatAlphaRemovalThreshold?: number;
    /** Progress callback: `percent` 0–100, a display label, and the loader
     * phase (an internal `LoaderStatus` enum value; treated as opaque). */
    onProgress?: (percent: number, label: string, status: number) => void;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    /** Load a `.ply` / `.splat` / `.ksplat` / `.spz` scene from a URL. */
    addSplatScene(url: string, options?: AddSplatSceneOptions): Promise<void>;
    /** Begin the self-driven render loop (call after `addSplatScene` resolves). */
    start(): void;
    /** Release the WebGL context, sort worker, and GPU buffers. */
    dispose(): Promise<void>;
  }
}
