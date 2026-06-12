export class Orb {
  private width = 48; // Physical pixels wide
  private height = 20; // Physical pixels high

  private dotMap = [
    [0x1, 0x8],
    [0x2, 0x10],
    [0x4, 0x20],
    [0x40, 0x80]
  ];

  render(time: number): string[] {
    const lines: string[] = [];
    const charW = this.width / 2;
    const charH = this.height / 4;

    for (let cy = 0; cy < charH; cy++) {
      let line = "";
      for (let cx = 0; cx < charW; cx++) {
        let v = 0, r = 0, g = 0, b = 0, c = 0;

        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const px = cx * 2 + dx;
            const py = cy * 4 + dy;

            // Orb is scaled down slightly to fit within background
            const nx = (px - (this.width / 2 - 0.5)) / (this.width / 2 * 0.4);
            const ny = (py - (this.height / 2 - 0.5)) / (this.height / 2 * 0.8);
            
            const d = Math.sqrt(nx * nx + ny * ny);
            if (d > 1) continue;

            const isBlink = Math.sin(time * 2.5) > 0.95;
            const eY = isBlink ? 0.05 : 0.25;
            const eX = 0.15;
            const lookX = Math.sin(time * 0.8) * 0.2;
            
            const dx1 = nx - (-0.35 + lookX);
            const dy1 = ny - (-0.2);
            const dx2 = nx - (0.35 + lookX);
            const dy2 = ny - (-0.2);
            
            const isEye = (dx1 * dx1) / (eX * eX) + (dy1 * dy1) / (eY * eY) < 1 || 
                          (dx2 * dx2) / (eX * eX) + (dy2 * dy2) / (eY * eY) < 1;

            if (isEye) continue;

            v |= this.dotMap[dy][dx];
            
            // TrueColor Cyan gradient
            r += 0;
            g += Math.floor(120 + 135 * Math.sin(d * 3 - time * 3));
            b += 255;
            c++;
          }
        }

        if (c > 0) {
          // Render Braille Orb Pixel
          const avgR = Math.floor(r / c);
          const avgG = Math.floor(g / c);
          const avgB = Math.floor(b / c);
          const char = String.fromCharCode(0x2800 + v);
          line += `\x1b[38;2;${avgR};${avgG};${avgB}m${char}\x1b[0m`;
        } else {
          // Render Dot-Matrix / Sci-Fi Radar Background
          const nx = (cx - (charW / 2 - 0.5)) / (charW / 2);
          const ny = (cy - (charH / 2 - 0.5)) / (charH / 2);
          const dBg = Math.sqrt(nx * nx + ny * ny);
          const ring = Math.abs(Math.sin(dBg * 10 - time * 3));
          
          if (ring < 0.2 && dBg < 1.0) {
            line += `\x1b[38;2;40;50;60m·\x1b[0m`; // Very subtle tech ring
          } else {
            line += " ";
          }
        }
      }
      lines.push(line);
    }
    return lines;
  }
}
