/**
 * A counting stand-in for `CanvasRenderingContext2D`, used to measure how much drawing work a renderer tier issues
 * without a browser (FS-701).
 *
 * It records nothing about pixels, so it proves work avoided, not that the result still looks right. Image differences
 * belong in the browser bench; this is the part that can run on every machine and in CI.
 */

export type DrawWork = {
  /** Path construction: every moveTo/lineTo/curve/arc/ellipse, on the context or on a Path2D. */
  segments: number;
  fills: number;
  strokes: number;
  clips: number;
  /** Gradient objects built during the frame. Each one allocates and is thrown away when the frame ends. */
  gradients: number;
  /** Rasterized frames blitted in, which is what the sprite tier trades all of the above for. */
  images: number;
  saves: number;
  /** Every operation above, as one number, so tiers can be compared at a glance. */
  total: number;
};

class RecordingGradient {
  addColorStop() {}
}

/** A Path2D stand-in that counts its own segments into the owning recorder. */
function path2DClass(count: (n?: number) => void) {
  return class RecordingPath2D {
    moveTo() { count(); }
    lineTo() { count(); }
    quadraticCurveTo() { count(); }
    bezierCurveTo() { count(); }
    arc() { count(); }
    ellipse() { count(); }
    closePath() { count(); }
  };
}

export class RecordingContext {
  segments = 0; fills = 0; strokes = 0; clips = 0; gradients = 0; images = 0; saves = 0;

  globalAlpha = 1;
  fillStyle: unknown = '#000';
  strokeStyle: unknown = '#000';
  lineWidth = 1;
  lineCap = 'butt';
  lineJoin = 'miter';
  font = '';
  textAlign = 'start';

  private bump = () => { this.segments++; };

  /** Install a Path2D that reports into this recorder, and return the function that puts the old one back. */
  installPath2D(): () => void {
    const scope = globalThis as { Path2D?: unknown };
    const previous = scope.Path2D;
    scope.Path2D = path2DClass(this.bump) as unknown as typeof Path2D;
    return () => { scope.Path2D = previous; };
  }

  work(): DrawWork {
    const { segments, fills, strokes, clips, gradients, images, saves } = this;
    return { segments, fills, strokes, clips, gradients, images, saves, total: segments + fills + strokes + clips + gradients + images + saves };
  }

  save() { this.saves++; }
  restore() {}
  translate() {}
  scale() {}
  rotate() {}
  transform() {}
  setTransform() {}
  getTransform() { return { a: 1 }; }
  setLineDash() {}

  beginPath() {}
  closePath() { this.segments++; }
  moveTo() { this.segments++; }
  lineTo() { this.segments++; }
  quadraticCurveTo() { this.segments++; }
  bezierCurveTo() { this.segments++; }
  arc() { this.segments++; }
  ellipse() { this.segments++; }

  fill() { this.fills++; }
  stroke() { this.strokes++; }
  clip() { this.clips++; }
  fillRect() { this.fills++; }
  strokeRect() { this.strokes++; }
  fillText() { this.fills++; }
  measureText() { return { width: 0 }; }
  drawImage() { this.images++; }

  createLinearGradient() { this.gradients++; return new RecordingGradient() as unknown as CanvasGradient; }
  createRadialGradient() { this.gradients++; return new RecordingGradient() as unknown as CanvasGradient; }
  createPattern() { return null; }

  get context(): CanvasRenderingContext2D { return this as unknown as CanvasRenderingContext2D; }
}

/** Run `draw` against a fresh recorder with a counting Path2D installed, and return the work it issued. */
export function measureWork(draw: (ctx: CanvasRenderingContext2D) => void): DrawWork {
  const recorder = new RecordingContext();
  const restore = recorder.installPath2D();
  try {
    draw(recorder.context);
  } finally {
    restore();
  }
  return recorder.work();
}
