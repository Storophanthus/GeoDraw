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
\\begin{tikzpicture}[scale=1.5,line cap=round]
\\tkzInit[xmin=-5,xmax=5.5,ymin=-3.12,ymax=4]
\\tkzDefPoints{1/2.12/A, 0/-3/B}
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
\\definecolor{myColor}{RGB}{100,100,100}
\\definecolor{myColor2}{RGB}{100,100,100}
\\begin{tikzpicture}
\\tkzDrawSegment[color=c1](A,B)
\\tkzDrawPoint[color=c2](A)
\\tkzLabelPoint[text=myColor](A){A}
\\tkzLabelPoint[text=myColor2](B){B}
\\end{tikzpicture}
    `.trim();

    const output = makeEfficientTikz(input);

    assertOk(output.includes("\\definecolor{c0}{RGB}{100,100,100}"), "Should define c0");
    assertOk(!output.includes("\\definecolor{c1}"), "Should not define c1");
    assertOk(!output.includes("\\definecolor{c2}"), "Should not define c2");
    assertOk(!output.includes("color=c1"), "Should replace color=c1");
    assertOk(output.includes("color=black"), "Should use black");
    assertOk(output.includes("color=red"), "Should use red");
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

runTest("rounds angle-label options and angle keyword syntax", () => {
    const input = `
\\tkzDefPointOnCircle[through = center O angle -150.161929357818 point tkzCircleR_1]
\\tkzLabelAngle[dist=0.376926862445237, angle=24.0822396243238, text=black](Y,A,D){$30^{\\circ}$}
    `.trim();
    const expected = `
\\tkzDefPointOnCircle[through = center O angle -150.16 point tkzCircleR_1]
\\tkzLabelAngle[dist=0.38, angle=24.08, text=black](Y,A,D){$30^{\\circ}$}
    `.trim();
    assertEqual(makeEfficientTikz(input), expected);
});

console.log("All tests passed");
