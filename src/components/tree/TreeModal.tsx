import { useEffect, useRef, useState } from "react";
import type { Tree } from "../../types/Types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (t: Tree) => void;
};

export default function TreeModal({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [note, setNote] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) {
      setName(""); setLat(""); setLng(""); setNote("");
      setPhotoDataUrl(undefined);
      const c = canvasRef.current; if (c) { c.style.display = "none"; c.getContext("2d")?.clearRect(0,0,c.width,c.height); }
    }
  }, [open]);

  const geolocate = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); },
      err => alert("Geolocation error: " + err.message)
    );
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const genFractal = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    c.style.display = "block";
    ctx.clearRect(0, 0, c.width, c.height);
    function branch(x: number, y: number, len: number, ang: number, depth: number) {
      if (depth === 0) return;
      const x2 = x + len * Math.cos(ang);
      const y2 = y - len * Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "#ffe100";
      ctx.lineWidth = depth * 1.2;
      ctx.stroke();
      const next = len * (0.65 + Math.random() * 0.1);
      const varA = 0.2 + Math.random() * 0.3;
      branch(x2, y2, next, ang - varA, depth - 1);
      branch(x2, y2, next, ang + varA, depth - 1);
    }
    branch(c.width / 2, c.height, 60 + Math.random() * 20, -Math.PI / 2, 6);
  };

  const submit = () => {
    const latN = parseFloat(lat), lngN = parseFloat(lng);
    if (!name || Number.isNaN(latN) || Number.isNaN(lngN)) {
      alert("Please fill tree name and coordinates.");
      return;
    }
    const fractalDataUrl =
      canvasRef.current && canvasRef.current.style.display === "block"
        ? canvasRef.current.toDataURL()
        : undefined;

    const t: Tree = {
      id: crypto.randomUUID(),
      name,
      kind: "lifetree",
      lat: latN,
      lng: lngN,
      note,
      color: "#28a745",
      photoDataUrl,
      fractalDataUrl,
    };
    onAdd(t);
    onClose();
  };

  return (
    <div className={`modal ${open ? "show" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <h3 className="text-lg mb-3">Add a New Tree</h3>
        <label className="block text-sm mb-1">Tree Name</label>
        <input className="w-full bg-[#0f151b] border border-white/10 rounded-lg p-2 mb-2"
               value={name} onChange={e=>setName(e.target.value)} placeholder="Give your tree a name" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">Latitude</label>
            <input className="w-full bg-[#0f151b] border border-white/10 rounded-lg p-2 mb-2"
                   value={lat} onChange={e=>setLat(e.target.value)} placeholder="Latitude" />
          </div>
          <div>
            <label className="block text-sm mb-1">Longitude</label>
            <input className="w-full bg-[#0f151b] border border-white/10 rounded-lg p-2 mb-2"
                   value={lng} onChange={e=>setLng(e.target.value)} placeholder="Longitude" />
          </div>
        </div>
        <button className="btn mb-2" onClick={geolocate}>Use my location</button>

        <label className="block text-sm mb-1">Note</label>
        <textarea className="w-full bg-[#0f151b] border border-white/10 rounded-lg p-2 mb-2"
                  rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note (optional)"></textarea>

        <label className="block text-sm mb-1">Guardian Picture (upload or generate)</label>
        <input type="file" accept="image/*" onChange={onPickPhoto} className="mb-2" placeholder="Guardian Picture" />
        {photoDataUrl && <img src={photoDataUrl} alt="preview" className="max-w-full mb-2 rounded-lg" />}

        <button className="btn mb-2" onClick={genFractal}>Generate Fractal</button>
        <canvas ref={canvasRef} width={200} height={200} className="hidden border border-white/10 rounded-lg"></canvas>

        <div className="flex justify-end gap-2 mt-3">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Add Tree</button>
        </div>
      </div>
    </div>
  );
}
