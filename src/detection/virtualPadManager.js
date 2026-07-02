import { instrumentMeta } from "../audio/drumKitConfig.js";

const VIRTUAL_PADS_STORAGE_KEY = "object-drum-studio.virtualPads.v1";

export class VirtualPadManager {
  constructor(options = {}) {
    this.pads = [];
    this.nextId = 1;
    this.maxPads = options.maxPads ?? 12;
  }

  reset() {
    this.pads = [];
    this.nextId = 1;
  }

  addPad(descriptor) {
    if (this.pads.length >= this.maxPads) return null;
    const pad = {
      id: `vpad-${this.nextId++}`,
      instrument: descriptor.instrument,
      normX: descriptor.normX,
      normY: descriptor.normY,
      size: descriptor.size,
      color: descriptor.color,
      createdAt: performance.now(),
    };
    this.pads.push(pad);
    return pad;
  }

  removePad(padId) {
    const idx = this.pads.findIndex((p) => p.id === padId);
    if (idx < 0) return false;
    this.pads.splice(idx, 1);
    return true;
  }

  movePad(padId, normX, normY) {
    const pad = this.pads.find((p) => p.id === padId);
    if (!pad) return false;
    pad.normX = normX;
    pad.normY = normY;
    return true;
  }

  getPads(viewport) {
    return this.pads.map((vpad) => {
      const meta = instrumentMeta(vpad.instrument);
      const px = Math.round(vpad.normX * viewport.width);
      const py = Math.round(vpad.normY * viewport.height);
      const pw = Math.max(8, Math.round(vpad.size * viewport.width));
      const ph = Math.max(8, Math.round(pw * 0.75));
      const bounds = {
        x: Math.round(px - pw / 2),
        y: Math.round(py - ph / 2),
        width: pw,
        height: ph,
      };
      return {
        id: vpad.id,
        instrument: vpad.instrument,
        label: meta.label,
        zhLabel: meta.zhLabel,
        ruleId: null,
        hue: 0,
        area: bounds.width * bounds.height,
        bounds,
        centroid: { x: px, y: py },
        color: hexToRgb(meta.color),
        outline: [
          { x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          { x: bounds.x, y: bounds.y + bounds.height },
        ],
        isVirtual: true,
        sourceId: vpad.id,
      };
    });
  }

  findPadNear(normX, normY, threshold = 0.04) {
    let best = null;
    let bestDist = Infinity;
    for (const p of this.pads) {
      const dx = p.normX - normX;
      const dy = p.normY - normY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  }

  serialize() {
    return this.pads.map((p) => ({ ...p }));
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    this.pads = data;
    this.nextId =
      Math.max(
        1,
        ...this.pads.map(
          (p) => Number.parseInt(String(p.id).replace("vpad-", "")) || 0
        )
      ) + 1;
  }

  save() {
    try {
      localStorage.setItem(
        VIRTUAL_PADS_STORAGE_KEY,
        JSON.stringify(this.serialize())
      );
    } catch {
      /* quota exceeded — silently ignore */
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(VIRTUAL_PADS_STORAGE_KEY);
      if (raw) this.deserialize(JSON.parse(raw));
    } catch {
      /* corrupt data — start fresh */
    }
  }
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
