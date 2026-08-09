import { baseColorTable } from "./colorTable";

export interface MakeEfficientTikzOptions {
    /**
     * Preserve numeric values that can change exported geometry or placement.
     *
     * Visual Exact uses this mode so coordinates, placement, stroke widths,
     * dash lengths, font sizes, and every other numeric visual metric retain
     * the precision produced by the renderer. Color and label compaction remain
     * enabled because they preserve the rendered value.
     *
     * Defaults to false to preserve the existing reconstructible-export output.
     */
    preserveGeometry?: boolean;
}

export function makeEfficientTikz(
    standardTex: string,
    options: MakeEfficientTikzOptions = {}
): string {
    let tex = standardTex;
    tex = applyNumericRounding(tex, options.preserveGeometry === true);
    tex = applyColorSimplification(tex);
    tex = applyLabelGrouping(tex);
    // Final cleanup: remove multiple blank lines
    tex = tex.replace(/\n\s*\n\s*\n/g, "\n\n");
    return tex;
}

// --- 1. Numeric Rounding ---

function applyNumericRounding(tex: string, preserveGeometry: boolean): string {
    // In Visual Exact, even "presentation" numbers are geometry: rounding a
    // stroke width, dash length, or font size changes the rendered PDF. Keep
    // the generated numeric stream intact and limit efficient-mode compaction
    // to equivalent color names and label grouping.
    if (preserveGeometry) return tex;

    // Any numeric input to a tkz construction can affect incidence, branch
    // identity, or even whether an intersection exists. Keep those lines exact;
    // efficient export may shorten presentation values, but not topology.
    const constructionLines: string[] = [];
    tex = tex
        .split("\n")
        .map((line) => {
            if (!/^\s*\\tkzDef[A-Za-z@]*/.test(line)) return line;
            const index = constructionLines.push(line) - 1;
            return `%%GD_CONSTRUCTION_LINE_${index}%%`;
        })
        .join("\n");

    // Helper to round numbers: 2 decimals, strip trailing zeros, -0 -> 0
    const fmtWithDecimals = (numStr: string, decimals: number) => {
        const n = parseFloat(numStr);
        if (isNaN(n)) return numStr;
        const factor = 10 ** decimals;
        const rounded = Math.round(n * factor) / factor;
        // This automatically handles stripping trailing zeros and -0 -> 0 (JS 0 is always positive 0 usually, but Math.round handles it)
        return rounded.toString();
    };
    const fmt = (numStr: string) => fmtWithDecimals(numStr, 2);
    const numberToken = "[-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?";
    const numberOnly = new RegExp(`^${numberToken}$`);
    const splitTopLevelComma = (input: string): string[] => {
        const out: string[] = [];
        let depth = 0;
        let token = "";
        for (let i = 0; i < input.length; i += 1) {
            const ch = input[i];
            if (ch === "{") depth += 1;
            if (ch === "}") depth = Math.max(0, depth - 1);
            if (ch === "," && depth === 0) {
                out.push(token);
                token = "";
                continue;
            }
            token += ch;
        }
        out.push(token);
        return out;
    };

    // 1. Preserve picture scale: tkz-euclide performs geometry using TeX
    // dimensions after transforms, so scale rounding can perturb intersections.

    // 2. \tkzInit values (xmin/xmax/ymin/ymax)
    tex = tex.replace(/(\\tkzInit\[)([^\]]+)(\])/g, (_m, start, content, end) => {
        const keyRegex = new RegExp(`\\b(xmin|xmax|ymin|ymax)=(${numberToken})`, "g");
        const newContent = String(content).replace(keyRegex, (_mm: string, k: string, v: string) => `${k}=${fmt(v)}`);
        return `${start}${newContent}${end}`;
    });

    // 3. pt values: line width=..., length=..., width=..., dash pattern=...
    // Regex for "key=value pt" or "key=valuept"
    // Keys: line width, length, width
    // Note: dash pattern is complex (on Xpt off Ypt).

    // Simple keys first
    const simpleKeys = ["line width", "length", "width", "size"];
    const simpleKeysRegex = new RegExp(`(${simpleKeys.join("|")})=(${numberToken})pt`, "g");
    tex = tex.replace(simpleKeysRegex, (_, key, val) => `${key}=${fmt(val)}pt`);

    // 3b. Font sizes in nodes: \fontsize{Xpt}{Ypt}\selectfont
    tex = tex.replace(
        new RegExp(`(\\\\fontsize\\{)(${numberToken})(pt\\}\\{)(${numberToken})(pt\\})`, "g"),
        (_m, p1, v1, p2, v2, p3) => `${p1}${fmt(v1)}${p2}${fmt(v2)}${p3}`
    );

    // Dash pattern: "on 2pt off 3pt", etc.
    tex = tex.replace(/(dash pattern=[^\]]+)/g, (match) => {
        const dashPieceRegex = new RegExp(`\\b(on|off)\\s+(${numberToken})pt`, "g");
        return match.replace(dashPieceRegex, (_m, kind, val) => `${kind} ${fmt(val)}pt`);
    });

    // 4. Unitless numeric fields (size=, mksize=, mkpos=)
    // These keys appear in options usually without 'pt' (defaulting to cm or factor)
    const unitlessKeys = ["size", "mksize", "mkpos", "dist", "angle"];
    const unitlessKeysRegex = new RegExp(`(${unitlessKeys.join("|")})=(${numberToken})`, "g");
    tex = tex.replace(unitlessKeysRegex, (_, key, val) => `${key}=${fmt(val)}`);

    // 4b. tkz angle syntax variants use "angle <value>".
    const angleKeywordRegex = new RegExp(`(\\bangle\\s+)(${numberToken})(?=\\b)`, "g");
    tex = tex.replace(angleKeywordRegex, (_, prefix, val) => `${prefix}${fmt(val)}`);

    // 4c. Numeric \foreach lists (e.g., \foreach \gdPos in {0.825000000000001,...})
    // Keep non-numeric tokens unchanged (like A/above).
    tex = tex.replace(
        /(\\foreach\s+\\[a-zA-Z@]+(?:\s*\/\s*\\[a-zA-Z@]+)*\s+in\s*\{)([^}]*)(\})/g,
        (_m, prefix, listBody, suffix) => {
            const items = splitTopLevelComma(String(listBody)).map((raw) => {
                const token = raw.trim();
                if (!token) return token;
                return numberOnly.test(token) ? fmt(token) : token;
            });
            return `${prefix}${items.join(",")}${suffix}`;
        }
    );

    // 5. Arrow decorations (mark=..., mark size=...)
    // We need to look inside \tkzDrawSegment[..., postaction={decorate, decoration={markings, mark=at position 0.5 ...}}]
    // The prompt mentions "arrow decoration numeric fields (positions, line widths, tip sizes)".
    // Position is usually "at position 0.5" or "0.6".
    // Arrow tip size is "length=...pt, width=...pt". (Handled directly by point 4?)
    // Let's explicitly handle "at position NUMBER with"
    tex = tex.replace(
        new RegExp(`(mark=at position\\s+)(${numberToken})(\\s+with)`, "g"),
        (_m, pre, val, post) => `${pre}${fmt(val)}${post}`
    );

    // Also handle arrow tip size in standard tikz arrows if present
    // We already handled "length=...pt" and "width=...pt" generally above.

    // 6. Non-construction coordinates (x,y)
    // Matches (Number, Number) or (Number,Number)
    tex = tex.replace(
        new RegExp(`\\(\\s*(${numberToken})\\s*,\\s*(${numberToken})\\s*\\)`, "g"),
        (_m, x, y) => `(${fmt(x)},${fmt(y)})`
    );

    // 7. Arc parameters (start:end:radius)
    // Matches (Number:Number:Number)
    tex = tex.replace(
        new RegExp(`\\(\\s*(${numberToken})\\s*:\\s*(${numberToken})\\s*:\\s*(${numberToken})\\s*\\)`, "g"),
        (_m, a, b, r) => `(${fmt(a)}:${fmt(b)}:${fmt(r)})`
    );

    return tex.replace(/%%GD_CONSTRUCTION_LINE_(\d+)%%/g, (_match, rawIndex: string) => {
        return constructionLines[Number(rawIndex)] ?? _match;
    });
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

    function extractSharedWrapper(body: string): { prefix: string; inner: string; suffix: string } | null {
        const wrappers = [
            { prefix: "{\\gdLabelGlow{$", suffix: "$}}" },
            { prefix: "\\gdLabelGlow{$", suffix: "$}" },
            { prefix: "{$", suffix: "$}" },
            { prefix: "$", suffix: "$" },
        ];

        for (const wrapper of wrappers) {
            if (!body.startsWith(wrapper.prefix) || !body.endsWith(wrapper.suffix)) continue;
            const inner = body.slice(wrapper.prefix.length, body.length - wrapper.suffix.length);
            return { prefix: wrapper.prefix, inner, suffix: wrapper.suffix };
        }

        return null;
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
                const wrappedBodies = buffer.map((b) => extractSharedWrapper(b.body));
                const firstWrapper = wrappedBodies[0];
                const allSameWrapper =
                    firstWrapper !== null &&
                    wrappedBodies.every(
                        (wrapped) =>
                            wrapped !== null &&
                            wrapped.prefix === firstWrapper.prefix &&
                            wrapped.suffix === firstWrapper.suffix
                    );

                if (allSameWrapper && firstWrapper) {
                    if (allSamePos) {
                        const pts = buffer.map((b, index) => `${b.point}/{${wrappedBodies[index]!.inner}}`).join(",");
                        const optStr = buffer[0].options;
                        newLines.push(
                            `\\foreach \\P/\\descr in {${pts}}{\\tkzLabelPoint[${optStr}](\\P){${firstWrapper.prefix}\\descr${firstWrapper.suffix}}}`
                        );
                    } else {
                        const pts = buffer
                            .map((b, index) => {
                                const pOpts = parseOptions(b.options);
                                return `${b.point}/${pOpts.pos}/{${wrappedBodies[index]!.inner}}`;
                            })
                            .join(",");
                        const optStr = otherOpts ? `\\pos, ${otherOpts}` : `\\pos`;
                        newLines.push(
                            `\\foreach \\P/\\pos/\\descr in {${pts}}{\\tkzLabelPoint[${optStr}](\\P){${firstWrapper.prefix}\\descr${firstWrapper.suffix}}}`
                        );
                    }
                    buffer = [];
                    return;
                }

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

            // Calibrated construction labels carry executable font commands in
            // their options. Keep those commands explicit instead of moving
            // them into a foreach template: this avoids TeX/clipboard layers
            // turning loop variables and font commands into doubled slashes.
            if (cleanOpts.includes("font=\\fontsize")) {
                flushBuffer();
                newLines.push(line);
                continue;
            }

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
