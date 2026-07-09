import { useEffect, useRef, useState } from "react";
import "./KitBuilder.css";

type ToolItemType =
  | "frontLogo"
  | "frontName"
  | "sponsor"
  | "backName"
  | "backNumber";

type ToolItem = {
  id: ToolItemType;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

type Swatch = {
  hex: string;
  rgb: [number, number, number];
};

const IMAGE_SRC = "/shirt.webp";

const DEFAULT_ITEMS: Record<ToolItemType, ToolItem> = {
  frontLogo: {
    id: "frontLogo",
    x: 150,
    y: 155,
    width: 55,
    height: 55,
  },
  frontName: {
    id: "frontName",
    x: 145,
    y: 235,
  },
  sponsor: {
    id: "sponsor",
    x: 145,
    y: 285,
  },
  backName: {
    id: "backName",
    x: 462,
    y: 175,
  },
  backNumber: {
    id: "backNumber",
    x: 462,
    y: 295,
  },
};

export default function KitBuilder(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const editedImageRef = useRef<ImageData | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [selectedSwatch, setSelectedSwatch] = useState<Swatch | null>(null);
  const [replaceColor, setReplaceColor] = useState<string>("#ff0000");
  const [tolerance, setTolerance] = useState<number>(75);

  const [frontName, setFrontName] = useState<string>("PLAYER");
  const [sponsorText, setSponsorText] = useState<string>("SPONSOR");
  const [backName, setBackName] = useState<string>("PLAYER");
  const [backNumber, setBackNumber] = useState<string>("10");

  const [items, setItems] =
    useState<Record<ToolItemType, ToolItem>>(DEFAULT_ITEMS);

  const [draggingId, setDraggingId] = useState<ToolItemType | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = IMAGE_SRC;
    img.onload = () => {
      baseImageRef.current = img;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);
      editedImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

      extractDominantColors();
      drawCanvas();
    };
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [frontName, sponsorText, backName, backNumber, items]);

  const rgbToHex = (r: number, g: number, b: number): string => {
    return (
      "#" +
      [r, g, b]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")
    );
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");

    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  };

  const colorDistance = (
    a: [number, number, number],
    b: [number, number, number]
  ): number => {
    return Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
        Math.pow(a[1] - b[1], 2) +
        Math.pow(a[2] - b[2], 2)
    );
  };

  const extractDominantColors = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const colorMap = new Map<string, { count: number; rgb: [number, number, number] }>();

    for (let i = 0; i < data.length; i += 24) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 200) continue;

      // Ignore white/very light background
      if (r > 235 && g > 235 && b > 235) continue;

      // Ignore near black shadows
      if (r < 25 && g < 25 && b < 25) continue;

      const rounded: [number, number, number] = [
        Math.round(r / 30) * 30,
        Math.round(g / 30) * 30,
        Math.round(b / 30) * 30,
      ];

      const key = rounded.join(",");

      if (!colorMap.has(key)) {
        colorMap.set(key, {
          count: 0,
          rgb: rounded,
        });
      }

      colorMap.get(key)!.count++;
    }

    const colors = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((item) => ({
        rgb: item.rgb,
        hex: rgbToHex(item.rgb[0], item.rgb[1], item.rgb[2]),
      }));

    setSwatches(colors);
  };

  const drawCanvas = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx || !editedImageRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(editedImageRef.current, 0, 0);

    drawLogo(ctx);
    drawTexts(ctx);
  };

  const drawLogo = (ctx: CanvasRenderingContext2D): void => {
    const logo = logoImageRef.current;
    if (!logo) return;

    const item = items.frontLogo;

    ctx.drawImage(
      logo,
      item.x,
      item.y,
      item.width || 55,
      item.height || 55
    );
  };

  const drawTexts = (ctx: CanvasRenderingContext2D): void => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Front name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial";
    ctx.fillText(frontName.toUpperCase(), items.frontName.x, items.frontName.y);

    // Sponsor text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText(sponsorText.toUpperCase(), items.sponsor.x, items.sponsor.y);

    // Back player name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText(backName.toUpperCase(), items.backName.x, items.backName.y);

    // Back jersey number
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 78px Arial";
    ctx.fillText(backNumber, items.backNumber.x, items.backNumber.y);
  };

  const applyColorReplacement = (): void => {
    if (!selectedSwatch || !editedImageRef.current) return;

    const imageData = editedImageRef.current;
    const data = imageData.data;

    const target = selectedSwatch.rgb;
    const replacement = hexToRgb(replaceColor);

    for (let i = 0; i < data.length; i += 4) {
      const current: [number, number, number] = [
        data[i],
        data[i + 1],
        data[i + 2],
      ];

      const distance = colorDistance(current, target);

      if (distance <= tolerance) {
        const shadowFactor =
          (data[i] + data[i + 1] + data[i + 2]) /
          (target[0] + target[1] + target[2] || 1);

        data[i] = Math.min(255, replacement[0] * shadowFactor);
        data[i + 1] = Math.min(255, replacement[1] * shadowFactor);
        data[i + 2] = Math.min(255, replacement[2] * shadowFactor);
      }
    }

    editedImageRef.current = imageData;
    drawCanvas();
  };

  const resetImage = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = baseImageRef.current;

    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    editedImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    drawCanvas();
  };

  const handleLogoUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const img = new Image();

    img.onload = () => {
      logoImageRef.current = img;
      drawCanvas();
    };

    img.src = URL.createObjectURL(file);
  };

  const getPointerPosition = (
    event: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const hitTest = (x: number, y: number): ToolItemType | null => {
    const logo = items.frontLogo;

    if (
      x >= logo.x &&
      x <= logo.x + (logo.width || 55) &&
      y >= logo.y &&
      y <= logo.y + (logo.height || 55)
    ) {
      return "frontLogo";
    }

    const textItems: ToolItemType[] = [
      "frontName",
      "sponsor",
      "backName",
      "backNumber",
    ];

    for (const id of textItems) {
      const item = items[id];

      if (Math.abs(x - item.x) < 90 && Math.abs(y - item.y) < 35) {
        return id;
      }
    }

    return null;
  };

  const handleMouseDown = (
    event: React.MouseEvent<HTMLCanvasElement>
  ): void => {
    const { x, y } = getPointerPosition(event);
    const selectedItem = hitTest(x, y);

    if (selectedItem) {
      setDraggingId(selectedItem);
      return;
    }

    // Select image color when clicking empty kit area
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const clickedRgb: [number, number, number] = [
      pixel[0],
      pixel[1],
      pixel[2],
    ];

    const nearest = swatches.reduce<Swatch | null>((best, swatch) => {
      if (!best) return swatch;

      const currentDistance = colorDistance(clickedRgb, swatch.rgb);
      const bestDistance = colorDistance(clickedRgb, best.rgb);

      return currentDistance < bestDistance ? swatch : best;
    }, null);

    setSelectedSwatch(nearest);
  };

  const handleMouseMove = (
    event: React.MouseEvent<HTMLCanvasElement>
  ): void => {
    if (!draggingId) return;

    const { x, y } = getPointerPosition(event);

    setItems((prev) => ({
      ...prev,
      [draggingId]: {
        ...prev[draggingId],
        x,
        y,
      },
    }));
  };

  const handleMouseUp = (): void => {
    setDraggingId(null);
  };

  const downloadImage = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = "custom-sports-kit.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="kit-builder-page">
      <section className="kit-builder-grid">
        <div className="canvas-card">
          <div className="canvas-toolbar">
            <p>Sports Kit Builder</p>

            <div>
              <button type="button" onClick={resetImage}>
                Reset
              </button>

              <button type="button" onClick={downloadImage}>
                Export PNG
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="kit-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            aria-label="Sports kit editor canvas"
          />
        </div>

        <aside className="editor-panel">
          <div className="guide-box">
            <p className="guide-label">Guide 1 of 6</p>
            <h2>Choose a mockup</h2>
            <p>The kit image is loaded as the editable mockup.</p>
          </div>

          <div className="control-box">
            <p className="guide-label">Guide 2 of 6</p>
            <h2>Change visible colors</h2>

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
                  onClick={() => setSelectedSwatch(swatch)}
                  aria-label={`Select color ${swatch.hex}`}
                />
              ))}
            </div>

            <label>
              Replace with
              <input
                type="color"
                value={replaceColor}
                onChange={(e) => setReplaceColor(e.target.value)}
              />
            </label>

            <label>
              Color match range: {tolerance}
              <input
                type="range"
                min="20"
                max="140"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
              />
            </label>

            <button
              type="button"
              onClick={applyColorReplacement}
              disabled={!selectedSwatch}
            >
              Apply Color
            </button>
          </div>

          <div className="control-box">
            <p className="guide-label">Guide 3 and 4 of 6</p>
            <h2>Edit directly on the kit</h2>
            <p>
              Click a kit color to select it, or drag the logo/name/number to
              reposition it.
            </p>
          </div>

          <div className="control-box">
            <p className="guide-label">Guide 5 of 6</p>
            <h2>Add logos and text</h2>

            <label>
              Front logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>

            <label>
              Front player name
              <input
                type="text"
                value={frontName}
                onChange={(e) => setFrontName(e.target.value)}
              />
            </label>

            <label>
              Sponsor name
              <input
                type="text"
                value={sponsorText}
                onChange={(e) => setSponsorText(e.target.value)}
              />
            </label>

            <label>
              Back player name
              <input
                type="text"
                value={backName}
                onChange={(e) => setBackName(e.target.value)}
              />
            </label>

            <label>
              Back jersey number
              <input
                type="text"
                value={backNumber}
                maxLength={2}
                onChange={(e) =>
                  setBackNumber(e.target.value.replace(/\D/g, ""))
                }
              />
            </label>
          </div>

          <div className="control-box">
            <p className="guide-label">Guide 6 of 6</p>
            <h2>Export or request a quote</h2>

            <button type="button" className="primary-btn" onClick={downloadImage}>
              Download Final Mockup
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}