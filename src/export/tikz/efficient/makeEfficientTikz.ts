import { baseColorTable } from "./colorTable";

export function makeEfficientTikz(standardTex: string): string {
    let tex = standardTex;
    tex = applyNumericRounding(tex);
    tex = applyColorSimplification(tex);
    tex = applyLabelGrouping(tex);
    // Final cleanup: remove multiple blank lines
    tex = tex.replace(/\n\s*\n\s*\n/g, "\n\n");
    return tex;
}

// --- 1. Numeric Rounding ---

function applyNumericRounding(tex: string): string {
    // Helper to round numbers: 2 decimals, strip trailing zeros, -0 -> 0
    const fmt = (numStr: string) => {
        const n = parseFloat(numStr);
        if (isNaN(n)) return numStr;
        // Round to 2 decimals
        const rounded = Math.round(n * 100) / 100;
        // This automatically handles stripping trailing zeros and -0 -> 0 (JS 0 is always positive 0 usually, but Math.round handles it)
        return rounded.toString();
    };
    const numberToken = "[-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?";


    // 1. scale=... in \begin{tikzpicture}[...]
    // Look for scale=NUMBER or scale=NUMBER, or ,scale=NUMBER
    tex = tex.replace(/(\\begin{tikzpicture}\[[^\]]*?scale=)([\d\.-]+)/g, (_, prefix, val) => prefix + fmt(val));

    // 2. \tkzInit matches (xmin=..., xmax=..., ymin=..., ymax=...)
    // We'll just target the specific keys inside tkzInit
    tex = tex.replace(/(\\tkzInit\[.*?)(xmin|xmax|ymin|ymax)=([\d\.-]+)/g, (_, prefix, key, val) => `${prefix}${key}=${fmt(val)}`);
    // Handle multiple occurrences/ordering in tkzInit requires being careful. 
    // Actually, standard export emits tkzInit in a specific way. 
    // But to be safe and robust, let's use a replacer that scans the inner content of tkzInit.
    tex = tex.replace(/(\\tkzInit\[)([^\]]+)(\])/g, (_, start, content, end) => {
        const newContent = content.replace(/(xmin|xmax|ymin|ymax)=([\d\.-]+)/g, (_m: string, k: string, v: string) => `${k}=${fmt(v)}`);
        return `${start}${newContent}${end}`;
    });

    // 3. coordinates inside \tkzDefPoints{...}
    // Format: x/y/name, x/y/name
    tex = tex.replace(/(\\tkzDefPoints{)([^}]+)(})/g, (_, start, content, end) => {
        // split by comma, then split by slash
        const parts = content.split(",").map((ptDef: string) => {
            const trimmed = ptDef.trim();
            if (!trimmed) return ptDef;
            const [x, y, name] = trimmed.split("/");
            if (x && y && name) {
                return `${fmt(x)}/${fmt(y)}/${name}`;
            }
            return ptDef; // fallback
        });
        return `${start}${parts.join(", ")}${end}`;
    });

    // 4. pt values: line width=..., length=..., width=..., dash pattern=...
    // Regex for "key=value pt" or "key=valuept"
    // Keys: line width, length, width
    // Note: dash pattern is complex (on Xpt off Ypt).

    // Simple keys first
    const simpleKeys = ["line width", "length", "width", "size"]; // Added size= for angles
    const simpleKeysRegex = new RegExp(`(${simpleKeys.join("|")})=([\\d\\.-]+)pt`, "g");
    tex = tex.replace(simpleKeysRegex, (_, key, val) => `${key}=${fmt(val)}pt`);

    // Dash pattern: "on 2pt off 3pt", etc.
    tex = tex.replace(/(dash pattern=[^\]]+)/g, (match) => {
        return match.replace(/([on|off]\s+)([\d\.-]+)pt/g, (_, type, val) => `${type}${fmt(val)}pt`);
    });

    // 5. Unitless numeric fields (size=, mksize=, mkpos=)
    // These keys appear in options usually without 'pt' (defaulting to cm or factor)
    const unitlessKeys = ["size", "mksize", "mkpos", "dist", "angle"];
    const unitlessKeysRegex = new RegExp(`(${unitlessKeys.join("|")})=(${numberToken})`, "g");
    tex = tex.replace(unitlessKeysRegex, (_, key, val) => `${key}=${fmt(val)}`);

    // 5b. tkz angle syntax variants use "angle <value>" (e.g., tkzDefPointOnCircle / rotation options).
    const angleKeywordRegex = new RegExp(`(\\bangle\\s+)(${numberToken})(?=\\b)`, "g");
    tex = tex.replace(angleKeywordRegex, (_, prefix, val) => `${prefix}${fmt(val)}`);

    // 5. Arrow decorations (mark=..., mark size=...)
    // We need to look inside \tkzDrawSegment[..., postaction={decorate, decoration={markings, mark=at position 0.5 ...}}]
    // The prompt mentions "arrow decoration numeric fields (positions, line widths, tip sizes)".
    // Position is usually "at position 0.5" or "0.6".
    // Arrow tip size is "length=...pt, width=...pt". (Handled directly by point 4?)
    // Let's explicitly handle "at position NUMBER with"
    tex = tex.replace(/(mark=at position\s+)([\d\.-]+)(\s+with)/g, (_, pre, val, post) => `${pre}${fmt(val)}${post}`);

    // Also handle arrow tip size in standard tikz arrows if present
    // We already handled "length=...pt" and "width=...pt" generally above.

    // 6. Coordinates (x,y)
    // Matches (Number, Number) or (Number,Number)
    tex = tex.replace(/\(([\d\.-]+)\s*,\s*([\d\.-]+)\)/g, (_, x, y) => `(${fmt(x)},${fmt(y)})`);

    // 7. Arc parameters (start:end:radius)
    // Matches (Number:Number:Number)
    tex = tex.replace(/\(([\d\.-]+)\s*:\s*([\d\.-]+)\s*:\s*([\d\.-]+)\)/g, (_, a, b, r) => `(${fmt(a)}:${fmt(b)}:${fmt(r)})`);

    return tex;
}

// --- 2. Color Simplification ---

function applyColorSimplification(tex: string): string {
    // 1. Parse \definecolor{NAME}{RGB}{r,g,b}
    const colorDefs: { name: string; rgb: string; r: number; g: number; b: number }[] = [];
    const defineColorRegex = /\\definecolor{([^}]+)}{RGB}{([\d,]+)}/g;

    let match;
    while ((match = defineColorRegex.exec(tex)) !== null) {
        const [_full, name, rgb] = match;
        const [r, g, b] = rgb.split(",").map(Number);
        colorDefs.push({ name, rgb, r, g, b });
    }

    // 2. Build mappings
    const oldNameToNewName = new Map<string, string>();
    const rgbToNewName = new Map<string, string>(); // Canonical name for this RGB
    const neededCustomColors = new Map<string, string>(); // newName -> RGB string

    let customColorCounter = 0;

    for (const def of colorDefs) {
        const { name, rgb } = def;

        // Check if it matches base colors
        const baseName = baseColorTable[rgb];
        if (baseName) {
            oldNameToNewName.set(name, baseName);
            rgbToNewName.set(rgb, baseName);
            continue;
        }

        // Check if we already have a name for this RGB (dedup)
        if (rgbToNewName.has(rgb)) {
            oldNameToNewName.set(name, rgbToNewName.get(rgb)!);
            continue;
        }

        // New custom color
        const newName = `c${customColorCounter++}`;
        oldNameToNewName.set(name, newName);
        rgbToNewName.set(rgb, newName);
        neededCustomColors.set(newName, rgb);
    }

    // 3. Remove all original \definecolor lines
    // We want to remove the whole line including the newline
    tex = tex.replace(/\\definecolor{([^}]+)}{RGB}{([\d,]+)}\s*\n?/g, "");

    // 4. Replace usages
    // We need to be careful to match whole words or specific contexts.
    // Contexts: color=NAME, draw=NAME, fill=NAME, text=NAME, mkcolor=NAME
    // Also inside arrow decorations: \arrow[color=NAME]
    // And potential other usages?  tkz-euclide often uses "color=..." or just options "red, thin".
    // But our standard export is predictable. It generates specific option keys.

    // Let's maintain a list of keys that take colors in our export.
    // keys: color, draw, fill, text, mkcolor
    // But wait, sometimes color is passed as a value to a general style option or just standalone in a list?
    // Standard export usually outputs explicit `color=...`.
    // Safest approach: Replace known old names appearing in option lists.
    // Since old names are likely generated like "gdC_..." (implied by prompt "color=gdC_..."), 
    // we can probably just replace valid color identifiers if they match our list.

    oldNameToNewName.forEach((newName, oldName) => {
        // Replace "color=oldName" -> "color=newName"
        // Replace "draw=oldName" -> "draw=newName"
        // etc.
        // Or just globally replace {oldName} or =oldName or ,oldName or [oldName
        // But be careful not to match substrings.
        // Assuming standard export uses distinct names (like gdC_hex).

        // Regex to match boundaries: [ ,={]NAME[ ,}\]]
        // Actually, usually it's `color=NAME` or `{NAME}` (if used in text color?).
        // Let's try global replacement with word boundaries if names are unique enough.
        // If names are like "gdColor_..." they are unique.

        const escapedOldName = oldName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(?<=^|[^a-zA-Z0-9_])${escapedOldName}(?=$|[^a-zA-Z0-9_])`, 'g');
        tex = tex.replace(regex, newName);
    });

    // 5. Re-emit \definecolor lines for used custom colors
    // We should put them at the top of the tikzpicture or after \tkzInit?
    // Standard export puts them before \tkzInit usually.
    // We'll insert them right after `\begin{tikzpicture}[...]` and potential prepended commands.
    // Or just find where the first definecolor was removed? 
    // Actually, we removed them all. The standard export likely had them in a block.
    // Let's insert them before `\tkzInit` if it exists, or after `\begin{tikzpicture}`.

    let newColorsStr = "";
    // Deterministic order: c0, c1, ...
    const sortedCustom = Array.from(neededCustomColors.entries())
        .sort((a, b) => {
            // Sort by cNUMBER
            const nA = parseInt(a[0].substring(1));
            const nB = parseInt(b[0].substring(1));
            return nA - nB;
        });

    for (const [name, rgb] of sortedCustom) {
        newColorsStr += `\\definecolor{${name}}{RGB}{${rgb}}\n`;
    }

    // Insert back
    if (tex.includes("\\tkzInit")) {
        tex = tex.replace("\\tkzInit", `${newColorsStr}\\tkzInit`);
    } else {
        // Fallback: insert after \begin{tikzpicture}[...] or \begin{tikzpicture}
        tex = tex.replace(/(\\begin{tikzpicture}(?:\[[^\]]*\])?)/, `$1\n${newColorsStr}`);
    }

    return tex;
}


// --- 3. Label Grouping ---


function applyLabelGrouping(tex: string): string {
    const labelRegex = /\\tkzLabelPoint\[(.*?)\]\(([^\)]+)\)\{(.*)\}/;
    const lines = tex.split("\n");
    const newLines: string[] = [];

    // Buffer to hold consecutive label commands
    let buffer: { options: string; point: string; body: string; originalLine: string }[] = [];

    const positionKeywords = new Set([
        "above", "below", "left", "right",
        "above left", "above right", "below left", "below right",
        "center"
    ]);

    function parseOptions(opts: string) {
        // Split by comma, trim
        const parts = opts.split(",").map(s => s.trim()).filter(s => s.length > 0);
        const positions: string[] = [];
        const otherOptions: string[] = [];

        for (const part of parts) {
            if (positionKeywords.has(part)) {
                positions.push(part);
            } else {
                otherOptions.push(part);
            }
        }
        return {
            pos: positions.join(" "), // e.g. "above left"
            others: otherOptions.sort().join(", ") // Normalized rest
        };
    }

    function isCompatible(prev: typeof buffer[0], currOpts: string, _currPoint: string, _currBody: string) {
        const prevParsed = parseOptions(prev.options);
        const currParsed = parseOptions(currOpts);

        // Must have same non-position options
        if (prevParsed.others !== currParsed.others) return false;

        // Grouping is possible if:
        // 1. Same body template (simple grouping, \P -> point name)
        // 2. OR varying body (complex grouping, \descr -> description)
        // We always try to group if options match.
        // We'll figure out the template strategy in flushBuffer.

        return true;
    }

    function extractBodyTemplate(body: string, pointName: string): string {
        const escaped = pointName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Look for exact word match of the point name
        const re = new RegExp(`(?<=^|[^a-zA-Z0-9_])${escaped}(?=$|[^a-zA-Z0-9_])`, 'g');
        return body.replace(re, "__POINT__");
    }

    function flushBuffer() {
        if (buffer.length === 0) return;
        if (buffer.length === 1) {
            newLines.push(buffer[0].originalLine);
        } else {
            // Check if positions vary
            const firstParsed = parseOptions(buffer[0].options);
            const allSamePos = buffer.every(b => parseOptions(b.options).pos === firstParsed.pos);
            const otherOpts = firstParsed.others;

            // Check if bodies generally match the standard template (\P)
            const firstTemplate = extractBodyTemplate(buffer[0].body, buffer[0].point);
            const allSameTemplate = buffer.every(b => extractBodyTemplate(b.body, b.point) === firstTemplate);

            if (allSameTemplate) {
                // Case 1: Same template (e.g. \gdLabelGlow{$A$} where A is the point)
                // We use \P in the loop
                const body = firstTemplate.replace(/__POINT__/g, "\\P");

                if (allSamePos) {
                    // \foreach \P in {A,B} { ... }
                    const pts = buffer.map(b => b.point).join(",");
                    const optStr = buffer[0].options;
                    newLines.push(`\\foreach \\P in {${pts}}{\\tkzLabelPoint[${optStr}](\\P){${body}}}`);
                } else {
                    // \foreach \P/\pos in {A/above, B/below} { ... }
                    const pts = buffer.map(b => {
                        const pOpts = parseOptions(b.options);
                        return `${b.point}/${pOpts.pos}`;
                    }).join(",");
                    const optStr = otherOpts ? `\\pos, ${otherOpts}` : `\\pos`;
                    newLines.push(`\\foreach \\P/\\pos in {${pts}}{\\tkzLabelPoint[${optStr}](\\P){${body}}}`);
                }
            } else {
                // Case 2: Varying bodies (e.g. $B_n$)
                // We need to extract the description content.
                // WE ASSUME the body has a consistent structure enclosing the text, e.g. \gdLabelGlow{...}
                // If the structure varies wildly (e.g. one has \textbf{...} and another doesn't), we can't easily template it.
                // Strategy: Just loop the *entire varying part* as \descr?
                // Or loop the *whole body* as \body?
                // \foreach \P/\body in {A/{\gdLabelGlow{$A$}}, B/{\gdLabelGlow{$B_n$}}}
                // This is robust!

                if (allSamePos) {
                    const pts = buffer.map(b => `${b.point}/{${b.body}}`).join(",");
                    const optStr = buffer[0].options;
                    newLines.push(`\\foreach \\P/\\descr in {${pts}}{\\tkzLabelPoint[${optStr}](\\P){\\descr}}`);
                } else {
                    const pts = buffer.map(b => {
                        const pOpts = parseOptions(b.options);
                        return `${b.point}/${pOpts.pos}/{${b.body}}`;
                    }).join(",");
                    const optStr = otherOpts ? `\\pos, ${otherOpts}` : `\\pos`;
                    newLines.push(`\\foreach \\P/\\pos/\\descr in {${pts}}{\\tkzLabelPoint[${optStr}](\\P){\\descr}}`);
                }
            }
        }
        buffer = [];
    }

    for (const line of lines) {
        const match = line.match(labelRegex);
        if (match) {
            const [originalLine, options, point, body] = match;
            const cleanOpts = options.trim();
            const cleanPoint = point.trim();
            const cleanBody = body; // don't trim body, spaces might matter inside latex? usually ok to keep as is

            if (buffer.length > 0) {
                if (isCompatible(buffer[0], cleanOpts, cleanPoint, cleanBody)) {
                    buffer.push({ options: cleanOpts, point: cleanPoint, body: cleanBody, originalLine });
                } else {
                    flushBuffer();
                    buffer.push({ options: cleanOpts, point: cleanPoint, body: cleanBody, originalLine });
                }
            } else {
                buffer.push({ options: cleanOpts, point: cleanPoint, body: cleanBody, originalLine });
            }
        } else {
            flushBuffer();
            newLines.push(line);
        }
    }
    flushBuffer();

    return newLines.join("\n");
}
