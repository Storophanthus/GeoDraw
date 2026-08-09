import { makeEfficientTikz } from "../makeEfficientTikz";

function assertOk(value: unknown, message = "Assertion failed"): asserts value {
    if (!value) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message = "Expected values to be equal"): void {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: ${String(expected)}\nActual: ${String(actual)}`);
    }
}

function runTest(name: string, fn: () => void) {
    try {
        fn();
        console.log(`PASS: ${name}`);
    } catch (e) {
        console.error(`FAIL: ${name}`);
        console.error(e);
        throw e;
    }
}

runTest("formats numbers (scale, coordinates, pt values)", () => {
    const input = `
\\begin{tikzpicture}[scale=1.50000000000000001,line cap=round]
\\tkzInit[xmin=-5.000000,xmax=5.50000,ymin=-3.123456,ymax=4.0]
\\tkzDefPoints{1.00/2.123456/A, -0.00000001/-3.0/B}
\\draw[line width=0.6000pt] (0,0) -- (1,1);
\\tkzDrawSegment[dotted, dash pattern=on 2.00pt off 3.500pt](A,B)
\\end{tikzpicture}
    `.trim();

    const expected = `
\\begin{tikzpicture}[scale=1.50000000000000001,line cap=round]
\\tkzInit[xmin=-5,xmax=5.5,ymin=-3.12,ymax=4]
\\tkzDefPoints{1.00/2.123456/A, -0.00000001/-3.0/B}
\\draw[line width=0.6pt] (0,0) -- (1,1);
\\tkzDrawSegment[dotted, dash pattern=on 2pt off 3.5pt](A,B)
\\end{tikzpicture}
    `.trim();

    assertEqual(makeEfficientTikz(input), expected);
});

runTest("simplifies colors", () => {
    const input = `
\\definecolor{c1}{RGB}{0,0,0}
\\definecolor{c2}{RGB}{255,0,0}
\\definecolor{c3}{RGB}{0,128,128}
\\definecolor{myColor}{RGB}{100,100,100}
\\definecolor{myColor2}{RGB}{100,100,100}
\\begin{tikzpicture}
\\tkzDrawSegment[color=c1](A,B)
\\tkzDrawPoint[color=c2](A)
\\tkzDrawCircle[color=c3](O,A)
\\tkzLabelPoint[text=myColor](A){A}
\\tkzLabelPoint[text=myColor2](B){B}
\\end{tikzpicture}
    `.trim();

    const output = makeEfficientTikz(input);

    assertOk(output.includes("\\definecolor{c0}{RGB}{100,100,100}"), "Should define c0");
    assertOk(!output.includes("\\definecolor{c1}"), "Should not define c1");
    assertOk(!output.includes("\\definecolor{c2}"), "Should not define c2");
    assertOk(!output.includes("\\definecolor{c3}"), "Should not define c3");
    assertOk(!output.includes("color=c1"), "Should replace color=c1");
    assertOk(output.includes("color=black"), "Should use black");
    assertOk(output.includes("color=red"), "Should use red");
    assertOk(output.includes("color=teal"), "Should use teal");
    assertOk(output.includes("text=c0"), "Should use c0");
});

runTest("groups consecutive labels", () => {
    const input = `
\\tkzLabelPoint[below](A){$A$}
\\tkzLabelPoint[below](B){$B$}
\\tkzLabelPoint[above right](C){{\\gdLabelGlow{$C$}}}
\\tkzLabelPoint[above right](D){{\\gdLabelGlow{$D$}}}
\\tkzLabelPoint[below](E){$E$}
    `.trim();

    const output = makeEfficientTikz(input);

    // Current optimizer may group consecutive labels with parameterized foreach tuple entries.
    try {
        assertOk(output.includes("\\foreach \\P/\\pos/\\descr in {"), "Missing grouped foreach header");
        assertOk(output.includes("A/below/{$A$}"), "Missing A label tuple");
        assertOk(output.includes("B/below/{$B$}"), "Missing B label tuple");
        assertOk(output.includes("C/above right/{{\\gdLabelGlow{$C$}}}"), "Missing C label tuple");
        assertOk(output.includes("D/above right/{{\\gdLabelGlow{$D$}}}"), "Missing D label tuple");
        assertOk(output.includes("E/below/{$E$}"), "Missing E label tuple");
        assertOk(output.includes("{\\tkzLabelPoint[\\pos](\\P){\\descr}}"), "Missing grouped foreach body");
    } catch (e) {
        console.log("OUTPUT:\n" + output);
        throw e;
    }
});

runTest("handles complex label templates", () => {
    const input = `
\\tkzLabelPoint[xshift=1pt](P1){$P1$}
\\tkzLabelPoint[xshift=1pt](P2){$P2$}
     `.trim();
    const output = makeEfficientTikz(input);
    assertOk(output.includes("\\foreach \\P in {P1,P2}{\\tkzLabelPoint[xshift=1pt](\\P){$\\P$}}"));
});

runTest("hoists shared gdLabelGlow wrapper outside grouped foreach tuples", () => {
    const input = `
\\tkzLabelPoint[above left, text=black](A){\\gdLabelGlow{$A$}}
\\tkzLabelPoint[below left, text=black](Ap){\\gdLabelGlow{$A^{\\prime}$}}
\\tkzLabelPoint[below, text=black](B){\\gdLabelGlow{$B$}}
\\tkzLabelPoint[above left, text=black](Bp){\\gdLabelGlow{$B^{\\prime}$}}
    `.trim();

    const output = makeEfficientTikz(input);

    assertOk(
        output.includes("\\foreach \\P/\\pos/\\descr in {A/above left/{A},Ap/below left/{A^{\\prime}},B/below/{B},Bp/above left/{B^{\\prime}}}{\\tkzLabelPoint[\\pos, text=black](\\P){\\gdLabelGlow{$\\descr$}}}"),
        "Expected grouped label export to hoist shared \\gdLabelGlow wrapper outside tuple payload."
    );
    assertOk(!output.includes("A/above left/{\\gdLabelGlow{$A$}}"), "Expected tuple payload to avoid repeated gdLabelGlow wrapper.");
});

runTest("keeps calibrated font labels explicit", () => {
    const input = `
\\tkzLabelPoint[above, font=\\fontsize{6pt}{7.2pt}\\selectfont, text=black](A){\\gdLabelGlow{$A$}}
\\tkzLabelPoint[below, font=\\fontsize{6pt}{7.2pt}\\selectfont, text=black](B){\\gdLabelGlow{$B$}}
    `.trim();
    const output = makeEfficientTikz(input);

    assertOk(!output.includes("\\foreach"), "Calibrated font labels must not be rewritten as a foreach loop.");
    assertOk(output.includes("\\tkzLabelPoint[above, font=\\fontsize{6pt}{7.2pt}\\selectfont, text=black](A)"));
    assertOk(output.includes("\\tkzLabelPoint[below, font=\\fontsize{6pt}{7.2pt}\\selectfont, text=black](B)"));
});

runTest("preserves construction angles while rounding label options", () => {
    const input = `
\\tkzDefPointOnCircle[through = center O angle -150.161929357818 point tkzCircleR_1]
\\tkzLabelAngle[dist=0.376926862445237, angle=24.0822396243238, text=black](Y,A,D){$30^{\\circ}$}
    `.trim();
    const expected = `
\\tkzDefPointOnCircle[through = center O angle -150.161929357818 point tkzCircleR_1]
\\tkzLabelAngle[dist=0.38, angle=24.08, text=black](Y,A,D){$30^{\\circ}$}
    `.trim();
    assertEqual(makeEfficientTikz(input), expected);
});

runTest("preserves near-tangent construction coordinates", () => {
    const input = `
\\tkzDefPoints{0/0/O,1/0/X,-2/0.9996/A,2/0.9996/B}
\\tkzInterLC[near](A,B)(O,X) \\tkzGetPoints{P}{Q}
    `.trim();
    const output = makeEfficientTikz(input);
    assertOk(output.includes("-2/0.9996/A"), "Construction rounding must not collapse a secant into a tangent.");
    assertOk(output.includes("2/0.9996/B"), "Construction rounding must retain both exact line anchors.");
});

runTest("preserves Visual Exact geometry precision while retaining harmless compaction", () => {
    const input = `
\\definecolor{gdAccent}{RGB}{255,0,0}
\\begin{tikzpicture}[scale=0.457687446419683]
\\tkzInit[xmin=-5.123456789012345,xmax=11.987654321098765,ymin=-8.765432109876543,ymax=10.123456789012345]
\\coordinate (A) at (0.12345678901234567,-9.8765432109876543);
\\draw[color=gdAccent, line width=0.47654321pt] (A) arc (12.3456789012345:98.7654321098765:4.56789012345678);
\\draw (A) arc[start angle=12.3456789012345,end angle=98.7654321098765,radius=4.56789012345678];
\\path[postaction={decorate,decoration={markings,mark=at position 0.825000000000001 with {\\arrow{>}}}}] (A) -- (1.9876543210987654,2.1234567890123456);
\\foreach \\gdPos in {0.825000000000001,0.912345678901234}{\\path (A) -- (1,1);}
\\tkzMarkAngle[size=0.376926862445237, mksize=0.123456789012345, mkpos=0.654321098765432, angle=24.0822396243238](B,A,C)
\\tkzLabelAngle[dist=0.376926862445237, angle=24.0822396243238](B,A,C){$30^{\\circ}$}
\\end{tikzpicture}
    `.trim();

    const output = makeEfficientTikz(input, { preserveGeometry: true });

    assertOk(
        output.includes("\\tkzInit[xmin=-5.123456789012345,xmax=11.987654321098765,ymin=-8.765432109876543,ymax=10.123456789012345]"),
        "Visual Exact viewport bounds must retain their full precision."
    );
    assertOk(
        output.includes("(0.12345678901234567,-9.8765432109876543)"),
        "Visual Exact coordinates must retain their full precision."
    );
    assertOk(
        output.includes("arc (12.3456789012345:98.7654321098765:4.56789012345678)"),
        "Visual Exact legacy arc geometry must retain its full precision."
    );
    assertOk(
        output.includes("arc[start angle=12.3456789012345,end angle=98.7654321098765,radius=4.56789012345678]"),
        "Visual Exact keyed arc geometry must retain its full precision."
    );
    assertOk(
        output.includes("mark=at position 0.825000000000001"),
        "Visual Exact mark positions must retain their full precision."
    );
    assertOk(
        output.includes("\\foreach \\gdPos in {0.825000000000001,0.912345678901234}"),
        "Visual Exact numeric foreach positions must retain their full precision."
    );
    assertOk(
        output.includes("size=0.376926862445237, mksize=0.123456789012345, mkpos=0.654321098765432, angle=24.0822396243238"),
        "Visual Exact angle and mark geometry must retain its full precision."
    );
    assertOk(
        output.includes("dist=0.376926862445237, angle=24.0822396243238"),
        "Visual Exact label placement must retain its full precision."
    );
    assertOk(output.includes("color=red"), "Equivalent color compaction should remain enabled.");
    assertOk(
        output.includes("line width=0.47654321pt"),
        "Visual Exact stroke widths must retain their full precision."
    );
});

runTest("preserves Visual Exact font and dash metrics", () => {
    const input = String.raw`\begin{tikzpicture}
\draw[line width=0.47654321pt,dash pattern=on 1.23456789pt off 2.34567891pt] (0,0) -- (1,1);
\node[font=\fontsize{12.19384756pt}{14.63261707pt}\selectfont] at (0,0) {$A$};
\end{tikzpicture}`;

    const output = makeEfficientTikz(input, { preserveGeometry: true });
    assertOk(output.includes("line width=0.47654321pt"));
    assertOk(output.includes("on 1.23456789pt off 2.34567891pt"));
    assertOk(output.includes("\\fontsize{12.19384756pt}{14.63261707pt}"));
});

runTest("keeps existing efficient rounding as the default", () => {
    const input = `
\\begin{tikzpicture}
\\tkzInit[xmin=-5.123456789012345,xmax=11.987654321098765]
\\coordinate (A) at (0.12345678901234567,-9.8765432109876543);
\\draw (A) arc (12.3456789012345:98.7654321098765:4.56789012345678);
\\end{tikzpicture}
    `.trim();

    const output = makeEfficientTikz(input);
    assertOk(output.includes("\\tkzInit[xmin=-5.12,xmax=11.99]"));
    assertOk(output.includes("(0.12,-9.88)"));
    assertOk(output.includes("arc (12.35:98.77:4.57)"));
});

console.log("All tests passed");
