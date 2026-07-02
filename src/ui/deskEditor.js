import { deskAreaFromCorners } from "../detection/deskDetector.js";

const DESK_AREA_STORAGE_KEY = "object-drum-studio.deskArea.v1";

export class DeskEditor {
  constructor() {
    this.corners = [];
    this.mode = "idle";
    this.activeCorner = -1;
    this.deskArea = null;
  }

  beginDraw(normPoint) {
    this.mode = "drawing";
    this.corners = [normPoint];
    this.deskArea = null;
  }

  updateDraw(normPoint) {
    if (this.mode !== "drawing" || this.corners.length < 1) return;
    this.corners = [this.corners[0], normPoint];
    this.deskArea = deskAreaFromCorners(this.corners);
  }

  endDraw(normPoint) {
    this.updateDraw(normPoint);
    this.mode = "idle";
    this.save();
    return this.deskArea;
  }

  beginAdjust(normPoint) {
    this.activeCorner = -1;
    let bestDist = 0.04;
    for (let i = 0; i < this.corners.length; i++) {
      const dx = this.corners[i].x - normPoint.x;
      const dy = this.corners[i].y - normPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        this.activeCorner = i;
      }
    }
    if (this.activeCorner >= 0) this.mode = "adjusting";
  }

  updateAdjust(normPoint) {
    if (this.mode !== "adjusting" || this.activeCorner < 0) return;
    this.corners[this.activeCorner] = normPoint;
    this.deskArea = deskAreaFromCorners(this.corners);
  }

  endAdjust() {
    this.mode = "idle";
    this.activeCorner = -1;
    this.save();
  }

  clear() {
    this.corners = [];
    this.deskArea = null;
    this.mode = "idle";
    this.save();
  }

  setFromRect(normRect) {
    this.corners = [
      { x: normRect.x, y: normRect.y },
      { x: normRect.x + normRect.width, y: normRect.y + normRect.height },
    ];
    this.deskArea = deskAreaFromCorners(this.corners);
    this.mode = "idle";
    this.save();
  }

  isActive() {
    return this.mode !== "idle";
  }

  hasDesk() {
    return !!this.deskArea;
  }

  save() {
    try {
      if (this.deskArea) {
        localStorage.setItem(
          DESK_AREA_STORAGE_KEY,
          JSON.stringify(this.deskArea)
        );
      } else {
        localStorage.removeItem(DESK_AREA_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(DESK_AREA_STORAGE_KEY);
      if (raw) {
        this.deskArea = JSON.parse(raw);
        // Reconstruct corners from quad
        if (this.deskArea?.quad) {
          this.corners = [this.deskArea.quad[0], this.deskArea.quad[2]];
        }
      }
    } catch {
      /* ignore */
    }
  }

  draw(ctx, width, height) {
    if (!this.deskArea) return;

    const sx = width;
    const sy = height;
    const quad = this.deskArea.quad;

    // Fill
    ctx.fillStyle = "rgba(100, 255, 140, 0.08)";
    ctx.beginPath();
    ctx.moveTo(quad[0].x * sx, quad[0].y * sy);
    for (let i = 1; i < quad.length; i++) {
      ctx.lineTo(quad[i].x * sx, quad[i].y * sy);
    }
    ctx.closePath();
    ctx.fill();

    // Dashed outline
    ctx.strokeStyle = "rgba(100, 255, 140, 0.52)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(quad[0].x * sx, quad[0].y * sy);
    for (let i = 1; i < quad.length; i++) {
      ctx.lineTo(quad[i].x * sx, quad[i].y * sy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner handles
    for (const corner of this.corners) {
      ctx.fillStyle = "rgba(100, 255, 140, 0.8)";
      ctx.beginPath();
      ctx.arc(corner.x * sx, corner.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
