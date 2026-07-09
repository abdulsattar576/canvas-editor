import { useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, IText } from "fabric";
import "./KitBuilder.css";

type RGB = [number, number, number];

type Swatch = {
  hex: string;
  rgb: RGB;
  count: number;
};

const IMAGE_SRC = "/shirt.webp";

export default function KitBuilder()  {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [selectedSwatch, setSelectedSwatch] = useState<Swatch | null>(null);
  const [replacementColor, setReplacementColor] = useState<string>("#e5252a");
  const [tolerance, setTolerance] = useState<number>(80);
  const [zoom, setZoom] = useState<number>(1);
  const [status, setStatus] = useState<string>("Loading editor...");

  useEffect(() => {
    setupEditor();

    return () => {
      fabricRef.current?.dispose();
    };
  }, []);

  const setupEditor = async (): Promise<void> => {
    if (!canvasRef.current) return;

    const fabricCanvas = new Canvas(canvasRef.current, {
      width: 1000,
      height: 720,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
    });

    fabricRef.current = fabricCanvas;

    const image = new Image();
    image.src = IMAGE_SRC;

    image.onload = async () => {
      originalImageRef.current = image;

      const workingCanvas = document.createElement("canvas");
      workingCanvas.width = image.width;
      workingCanvas.height = image.height;

      const ctx = workingCanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(image, 0, 0);
      workingCanvasRef.current = workingCanvas;

      await updateBackgroundFromWorkingCanvas();
      extractAndSetColors();
      addDefaultObjects();

      setStatus("Editor ready. Select a color or click the mockup.");
    };

    image.onerror = () => {
      setStatus("Image not found. Please add public/shirt.webp.");
    };
  };

  const updateBackgroundFromWorkingCanvas = async (): Promise<void> => {
    const fabricCanvas = fabricRef.current;
    const workingCanvas = workingCanvasRef.current;

    if (!fabricCanvas || !workingCanvas) return;

    const url = workingCanvas.toDataURL("image/png");
    const backgroundImage = await FabricImage.fromURL(url);

    const scale = Math.min(
      fabricCanvas.getWidth() / backgroundImage.width!,
      fabricCanvas.getHeight() / backgroundImage.height!
    );

    backgroundImage.set({
      left: fabricCanvas.getWidth() / 2,
      top: fabricCanvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });

    fabricCanvas.backgroundImage = backgroundImage;
    fabricCanvas.renderAll();
  };

  const addDefaultObjects = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const frontName = createText("PLAYER", 270, 330, 24);
    const sponsor = createText("SPONSOR", 270, 375, 30);
    const backName = createText("SATTAR", 720, 245, 38);
    const backNumber = createText("40", 720, 350, 96);

    canvas.add(frontName, sponsor, backName, backNumber);
    canvas.renderAll();
  };

  const createText = (
    text: string,
    left: number,
    top: number,
    fontSize: number
  ): IText => {
    return new IText(text, {
      left,
      top,
      fontSize,
      fill: "#ffffff",
      stroke: "rgba(0,0,0,0.35)",
      strokeWidth: 1.5,
      fontWeight: "bold",
      fontFamily: "Arial",
      originX: "center",
      originY: "center",
      cornerColor: "#e5252a",
      borderColor: "#e5252a",
      transparentCorners: false,
    });
  };

  const clamp = (value: number): number => {
    return Math.max(0, Math.min(255, Math.round(value)));
  };

  const rgbToHex = (r: number, g: number, b: number): string => {
    return (
      "#" +
      [r, g, b]
        .map((value) => clamp(value).toString(16).padStart(2, "0"))
        .join("")
    );
  };

  const hexToRgb = (hex: string): RGB => {
    const clean = hex.replace("#", "");

    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  };

  const colorDistance = (a: RGB, b: RGB): number => {
    return Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
        Math.pow(a[1] - b[1], 2) +
        Math.pow(a[2] - b[2], 2)
    );
  };

  const extractAndSetColors = (): void => {
    const workingCanvas = workingCanvasRef.current;
    const ctx = workingCanvas?.getContext("2d");

    if (!workingCanvas || !ctx) return;

    const imageData = ctx.getImageData(
      0,
      0,
      workingCanvas.width,
      workingCanvas.height
    );

    const colorMap = new Map<string, Swatch>();

    for (let i = 0; i < imageData.data.length; i += 28) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      if (a < 220) continue;
      if (r > 235 && g > 235 && b > 235) continue;
      if (r < 18 && g < 18 && b < 18) continue;

      const grouped: RGB = [
        Math.round(r / 24) * 24,
        Math.round(g / 24) * 24,
        Math.round(b / 24) * 24,
      ];

      const hex = rgbToHex(grouped[0], grouped[1], grouped[2]);
      const existing = colorMap.get(hex);

      if (existing) {
        existing.count += 1;
      } else {
        colorMap.set(hex, {
          hex,
          rgb: grouped,
          count: 1,
        });
      }
    }

    const colors = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setSwatches(colors);

    if (colors.length > 0) {
      setSelectedSwatch(colors[0]);
      setReplacementColor(colors[0].hex);
    }
  };

  const applyColorReplacement = async (): Promise<void> => {
    const workingCanvas = workingCanvasRef.current;
    const ctx = workingCanvas?.getContext("2d");

    if (!workingCanvas || !ctx || !selectedSwatch) return;

    const imageData = ctx.getImageData(
      0,
      0,
      workingCanvas.width,
      workingCanvas.height
    );

    const data = imageData.data;
    const target = selectedSwatch.rgb;
    const replacement = hexToRgb(replacementColor);

    const targetBrightness =
      target[0] * 0.299 + target[1] * 0.587 + target[2] * 0.114 || 1;

    for (let i = 0; i < data.length; i += 4) {
      const current: RGB = [data[i], data[i + 1], data[i + 2]];

      if (colorDistance(current, target) <= tolerance) {
        const currentBrightness =
          current[0] * 0.299 + current[1] * 0.587 + current[2] * 0.114;

        const shadeFactor = currentBrightness / targetBrightness;

        data[i] = clamp(replacement[0] * shadeFactor);
        data[i + 1] = clamp(replacement[1] * shadeFactor);
        data[i + 2] = clamp(replacement[2] * shadeFactor);
      }
    }

    ctx.putImageData(imageData, 0, 0);

    await updateBackgroundFromWorkingCanvas();
    extractAndSetColors();

    const updated: Swatch = {
      hex: replacementColor,
      rgb: replacement,
      count: 0,
    };

    setSelectedSwatch(updated);
    setStatus(`Color changed to ${replacementColor}.`);
  };

  const addSponsorText = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const text = createText("NEW SPONSOR", 270, 420, 28);
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const addPlayerName = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const text = createText("PLAYER NAME", 720, 245, 36);
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const addJerseyNumber = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const text = createText("10", 720, 360, 96);
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const uploadLogo = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    const canvas = fabricRef.current;

    if (!file || !canvas) return;

    const url = URL.createObjectURL(file);
    const logo = await FabricImage.fromURL(url);

    logo.set({
      left: 270,
      top: 285,
      originX: "center",
      originY: "center",
      scaleX: 0.18,
      scaleY: 0.18,
      cornerColor: "#e5252a",
      borderColor: "#e5252a",
      transparentCorners: false,
    });

    canvas.add(logo);
    canvas.setActiveObject(logo);
    canvas.renderAll();

    setStatus("Logo added. Drag or resize it on the kit.");
  };

  const deleteSelected = (): void => {
    const canvas = fabricRef.current;
    const activeObject = canvas?.getActiveObject();

    if (!canvas || !activeObject) return;

    canvas.remove(activeObject);
    canvas.discardActiveObject();
    canvas.renderAll();

    setStatus("Selected object removed.");
  };

  const bringForward = (): void => {
    const canvas = fabricRef.current;
    const activeObject = canvas?.getActiveObject();

    if (!canvas || !activeObject) return;

    canvas.bringObjectForward(activeObject);
    canvas.renderAll();
  };

  const sendBackward = (): void => {
    const canvas = fabricRef.current;
    const activeObject = canvas?.getActiveObject();

    if (!canvas || !activeObject) return;

    canvas.sendObjectBackwards(activeObject);
    canvas.renderAll();
  };

  const zoomIn = (): void => {
    const next = Math.min(1.8, Number((zoom + 0.1).toFixed(1)));
    setZoom(next);
    fabricRef.current?.setZoom(next);
  };

  const zoomOut = (): void => {
    const next = Math.max(0.7, Number((zoom - 0.1).toFixed(1)));
    setZoom(next);
    fabricRef.current?.setZoom(next);
  };

  const resetZoom = (): void => {
    setZoom(1);
    fabricRef.current?.setZoom(1);
  };

  const resetEditor = async (): Promise<void> => {
    const image = originalImageRef.current;
    const canvas = fabricRef.current;

    if (!image || !canvas) return;

    canvas.clear();
    canvas.backgroundColor = "#ffffff";

    const workingCanvas = document.createElement("canvas");
    workingCanvas.width = image.width;
    workingCanvas.height = image.height;

    const ctx = workingCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(image, 0, 0);
    workingCanvasRef.current = workingCanvas;

    await updateBackgroundFromWorkingCanvas();
    extractAndSetColors();
    addDefaultObjects();

    setZoom(1);
    canvas.setZoom(1);
    setStatus("Editor reset.");
  };

  const downloadPng = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "custom-kit.png";
    link.click();

    setStatus("PNG downloaded.");
  };

  const copyDesignJson = async (): Promise<void> => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const data = {
      canvas: canvas.toJSON(),
      selectedColor: selectedSwatch,
      replacementColor,
      tolerance,
    };

    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setStatus("Design JSON copied to clipboard.");
  };

  const requestQuote = (): void => {
    setStatus("Quote request action ready. Connect this with your backend.");
  };

  return (
    <main className="kit-builder-page">
      <header className="builder-header">
        <div>
          <p>Custom Kit Builder</p>
          <h1>Customize Soccer Uniform</h1>
        </div>

        <button type="button" onClick={copyDesignJson}>
          Save / Share JSON
        </button>
      </header>

      <nav className="builder-steps" aria-label="Builder steps">
        <span>1 Choose Mockup</span>
        <span>2 Change Colors</span>
        <span>3 Edit Canvas</span>
        <span>4 Add Logo & Text</span>
        <span>5 Export / Quote</span>
      </nav>

      <section className="builder-layout">
        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <p>{status}</p>

            <div className="toolbar-buttons">
              <button type="button" onClick={zoomOut}>
                −
              </button>

              <button type="button" onClick={resetZoom}>
                {Math.round(zoom * 100)}%
              </button>

              <button type="button" onClick={zoomIn}>
                +
              </button>

              <button type="button" onClick={deleteSelected}>
                Delete
              </button>

              <button type="button" onClick={bringForward}>
                Forward
              </button>

              <button type="button" onClick={sendBackward}>
                Backward
              </button>

              <button type="button" onClick={resetEditor}>
                Reset
              </button>

              <button type="button" onClick={downloadPng}>
                Download
              </button>
            </div>
          </div>

          <div className="canvas-shell">
            <canvas ref={canvasRef} />
          </div>
        </section>

        <aside className="side-panel">
          <section className="panel-card">
            <div className="panel-title">
              <span>Guide 2 of 6</span>
              <h2>Mockup Colors</h2>
            </div>

            <div className="swatch-grid">
              {swatches.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  className={
                    selectedSwatch?.hex === swatch.hex
                      ? "swatch active"
                      : "swatch"
                  }
                  style={{ backgroundColor: swatch.hex }}
                  title={`${swatch.hex} · ${swatch.count}`}
                  onClick={() => {
                    setSelectedSwatch(swatch);
                    setReplacementColor(swatch.hex);
                  }}
                  aria-label={`Select ${swatch.hex}`}
                />
              ))}
            </div>

            <div className="selected-color">
              <span
                style={{
                  backgroundColor: selectedSwatch?.hex || "#ffffff",
                }}
              />
              <div>
                <strong>{selectedSwatch?.hex || "No color selected"}</strong>
                <small>Selected visible color</small>
              </div>
            </div>

            <label>
              Replace with
              <input
                type="color"
                value={replacementColor}
                onChange={(event) => setReplacementColor(event.target.value)}
              />
            </label>

            <label>
              Match range: {tolerance}
              <input
                type="range"
                min="25"
                max="150"
                value={tolerance}
                onChange={(event) => setTolerance(Number(event.target.value))}
              />
            </label>

            <button
              type="button"
              className="primary-button"
              disabled={!selectedSwatch}
              onClick={applyColorReplacement}
            >
              Apply Color
            </button>
          </section>

          <section className="panel-card">
            <div className="panel-title">
              <span>Guide 5 of 6</span>
              <h2>Logos and Text</h2>
            </div>

            <label>
              Upload front logo
              <input type="file" accept="image/*" onChange={uploadLogo} />
            </label>

            <div className="button-grid">
              <button type="button" onClick={addSponsorText}>
                Add Sponsor
              </button>

              <button type="button" onClick={addPlayerName}>
                Add Player Name
              </button>

              <button type="button" onClick={addJerseyNumber}>
                Add Number
              </button>
            </div>

            <p>
              Double click text to edit. Drag logo or text to place it on the
              front, shoes, or back area.
            </p>
          </section>

          <section className="quote-card">
            <h2>Review & Request Quote</h2>

            <div className="summary-row">
              <span>Mockup</span>
              <strong>Soccer Kit</strong>
            </div>

            <div className="summary-row">
              <span>Decoration</span>
              <strong>Sublimation</strong>
            </div>

            <div className="summary-row">
              <span>Output</span>
              <strong>PNG + JSON</strong>
            </div>

            <button type="button" className="quote-button" onClick={requestQuote}>
              Request Quote
            </button>
          </section>
        </aside>
      </section>
    </main>
  );
}