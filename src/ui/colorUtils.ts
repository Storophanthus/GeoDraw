export function toRgba(color: string, alpha: number): string {
    const hex = color.trim();
    const match3 = /^#([0-9a-fA-F]{3})$/.exec(hex);
    if (match3) {
        const [r, g, b] = match3[1].split("").map((d) => parseInt(d + d, 16));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const match6 = /^#([0-9a-fA-F]{6})$/.exec(hex);
    if (match6) {
        const raw = match6[1];
        const r = parseInt(raw.slice(0, 2), 16);
        const g = parseInt(raw.slice(2, 4), 16);
        const b = parseInt(raw.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
}
