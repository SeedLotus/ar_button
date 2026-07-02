import { INSTRUMENTS } from "../audio/drumKitConfig.js";

export const VIRTUAL_PAD_DEFAULTS = {
  size: 0.07,
};

export function virtualPadPaletteItems() {
  return INSTRUMENTS.map((inst) => ({
    instrumentId: inst.id,
    label: inst.label,
    zhLabel: inst.zhLabel,
    color: inst.color,
    defaultSize: VIRTUAL_PAD_DEFAULTS.size,
  }));
}

export function renderVirtualPadPalette(container, items) {
  container.innerHTML = items
    .map(
      (item, idx) => `
    <button class="vpad-item"
            data-instrument="${item.instrumentId}"
            data-index="${idx}"
            draggable="true"
            type="button"
            title="拖拽到桌面画面放置 ${item.label}">
      <span class="vpad-swatch" style="background:${item.color}"></span>
      <div class="vpad-label">
        <strong>${item.label}</strong>
        <small>${item.zhLabel}</small>
      </div>
    </button>`
    )
    .join("");
}
