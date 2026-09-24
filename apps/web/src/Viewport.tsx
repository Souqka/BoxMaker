import { sheetPointToPanel, type BuildResult, type PanelId } from "@fanera/core";
import { useEffect, useRef, useState } from "react";
import { PANEL_LABELS } from "./labels.ts";

interface ViewportProps {
  result: BuildResult;
  selectedPanel: PanelId;
  onSelectPanel: (id: PanelId) => void;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

export function Viewport({ result, selectedPanel, onSelectPanel }: ViewportProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 24, y: 24, scale: 1 });
  const [cursor, setCursor] = useState<string>("—");

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      setCamera((current) => {
        const scale = clamp(current.scale * factor, 0.35, 10);
        const ratio = scale / current.scale;
        return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      });
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !result.ok) return;
    for (const node of frame.querySelectorAll("[data-role='cut']")) {
      node.classList.toggle("is-selected", node.getAttribute("data-panel") === selectedPanel);
    }
  }, [result, selectedPanel]);

  function zoomBy(factor: number) {
    const frame = frameRef.current;
    const rect = frame?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    setCamera((current) => {
      const scale = clamp(current.scale * factor, 0.35, 10);
      const ratio = scale / current.scale;
      return { scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }

  function download() {
    if (!result.ok) return;
    const blob = new Blob([result.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fanera-box.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="viewport">
      <div className="viewport-tools">
        <button type="button" onClick={() => setCamera({ x: 24, y: 24, scale: 1 })}>
          Вписать
        </button>
        <button type="button" onClick={() => zoomBy(1.15)}>
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.15)}>
          −
        </button>
        <button type="button" onClick={download} disabled={!result.ok}>
          Скачать SVG
        </button>
        <span className="cursor">{cursor}</span>
      </div>
      <div
        className="frame"
        ref={frameRef}
        onPointerDown={(event) => {
          if (!result.ok) return;
          const target = event.target as Element;
          const panel = target.closest?.("[data-panel]")?.getAttribute("data-panel");
          if (isPanelId(panel)) onSelectPanel(panel);
          const startX = event.clientX;
          const startY = event.clientY;
          const origin = camera;
          let moved = false;
          const move = (next: PointerEvent) => {
            const dx = next.clientX - startX;
            const dy = next.clientY - startY;
            if (Math.hypot(dx, dy) > 3) moved = true;
            if (moved) setCamera({ ...origin, x: origin.x + dx, y: origin.y + dy });
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
        onPointerMove={(event) => {
          if (!result.ok) {
            setCursor("—");
            return;
          }
          const svg = frameRef.current?.querySelector("svg");
          const matrix = svg?.getScreenCTM();
          if (!svg || !matrix) return;
          const point = svg.createSVGPoint();
          point.x = event.clientX;
          point.y = event.clientY;
          const local = point.matrixTransform(matrix.inverse());
          const sheet = { x: local.x, y: result.layout.height - local.y };
          const placement = result.layout.placements.find(
            (item) => sheet.x >= item.x && sheet.x <= item.x + item.width && sheet.y >= item.y && sheet.y <= item.y + item.height,
          );
          if (!placement) {
            setCursor(`лист ${trim(sheet.x)}, ${trim(sheet.y)} мм`);
            return;
          }
          const panel = result.panels.find((item) => item.id === placement.panelId);
          if (!panel) return;
          const localPanel = sheetPointToPanel(panel, placement, sheet);
          setCursor(`${PANEL_LABELS[panel.id]} ${trim(localPanel.x)}, ${trim(localPanel.y)} мм`);
        }}
      >
        {result.ok ? (
          <div
            className="sheet"
            style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}
            dangerouslySetInnerHTML={{ __html: result.svg.replace(/^<\?xml[^>]*>\s*/, "") }}
          />
        ) : (
          <p className="empty">Геометрия не построена. Исправьте параметры слева.</p>
        )}
      </div>
    </section>
  );
}

function isPanelId(value: string | null | undefined): value is PanelId {
  return value === "front" || value === "back" || value === "left" || value === "right" || value === "bottom" || value === "lid";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}
