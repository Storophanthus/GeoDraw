import { makeEfficientTikz } from "../makeEfficientTikz";
import assert from "assert";

function runTest(name: string, fn: () => void) {
    try {
        fn();
        console.log(`PASS: ${name}`);
    } catch (e) {
        console.error(`FAIL: ${name}`);
        console.error(e);
        process.exit(1);
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

    assert.strictEqual(makeEfficientTikz(input), expected);
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

    assert.ok(output.includes("\\definecolor{c0}{RGB}{100,100,100}"), "Should define c0");
    assert.ok(!output.includes("\\definecolor{c1}"), "Should not define c1");
    assert.ok(!output.includes("\\definecolor{c2}"), "Should not define c2");
    assert.ok(!output.includes("color=c1"), "Should replace color=c1");
    assert.ok(output.includes("color=black"), "Should use black");
    assert.ok(output.includes("color=red"), "Should use red");
    assert.ok(output.includes("text=c0"), "Should use c0");
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

    // Check for foreach structures
    try {
        assert.ok(output.includes("\\foreach \\P in {A,B}{\\tkzLabelPoint[below](\\P){$\\P$}}"), "Missing A,B group");
        assert.ok(output.includes("\\foreach \\P in {C,D}{\\tkzLabelPoint[above right](\\P){{\\gdLabelGlow{$\\P$}}}}"), "Missing C,D group");
        assert.ok(output.includes("\\tkzLabelPoint[below](E){$E$}"), "Missing E");
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
    assert.ok(output.includes("\\foreach \\P in {P1,P2}{\\tkzLabelPoint[xshift=1pt](\\P){$\\P$}}"));
});

console.log("All tests passed");
