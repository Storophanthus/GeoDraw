import { assignGenericIntersectionPairPoints } from "../eval/intersectionAssignments";
import { type Vec2 } from "../../geo/vec2";

function fail(message: string): never {
    throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) fail(message);
}

// Mocking ops
let stableMemory = new Map<string, Vec2>();
const ops = {
    getExcludedPointWorld: () => null as Vec2 | null,
    getPreviousStablePoint: (id: string) => stableMemory.get(id) || null,
    rememberStablePoint: (id: string, value: Vec2) => stableMemory.set(id, value),
};

// Test 1: Basic stability on root reordering (2x2 fast-path)
{
    stableMemory.clear();
    const r0: Vec2 = { x: 10, y: 10 };
    const r1: Vec2 = { x: 20, y: 20 };
    const pairPoints = [
        { id: "P1", branchIndex: 0 },
        { id: "P2", branchIndex: 1 },
    ];

    // Frame 1: Roots [r0, r1]
    const out1 = assignGenericIntersectionPairPoints(pairPoints, [r0, r1], ops);
    assert(out1.get("P1") === r0, "Frame 1: P1 should be r0");
    assert(out1.get("P2") === r1, "Frame 1: P2 should be r1");

    // Frame 2: Roots swapped [r1, r0]. Index 0 is now r1, Index 1 is now r0.
    const out2 = assignGenericIntersectionPairPoints(pairPoints, [r1, r0], ops);
    // Stability should override index-based branch and keep points at same world coords
    assert(out2.get("P1") === r0, "Frame 2: P1 should stay at world r0 despite index swap");
    assert(out2.get("P2") === r1, "Frame 2: P2 should stay at world r1 despite index swap");
}

// Test 2: Stability with jitter (2x2 fast-path)
{
    stableMemory.clear();
    const r0: Vec2 = { x: 0, y: 0 };
    const r1: Vec2 = { x: 0.0001, y: 0 };
    const pairPoints = [
        { id: "P1", branchIndex: 0 },
        { id: "P2", branchIndex: 1 },
    ];

    assignGenericIntersectionPairPoints(pairPoints, [r0, r1], ops);

    // Roots swap indices: index 0 is now where r1 was, index 1 is where r0 was.
    const r0_new: Vec2 = { x: 0.0001, y: 0 };
    const r1_new: Vec2 = { x: 0, y: 0 };
    const out2 = assignGenericIntersectionPairPoints(pairPoints, [r0_new, r1_new], ops);

    // P1 should track its world position (which is now index 1)
    assert(out2.get("P1")?.x === r1_new.x, "P1 should follow world position (idx 1)");
    assert(out2.get("P2")?.x === r0_new.x, "P2 should follow world position (idx 0)");
}

// Test 3: preferredWorld support
{
    stableMemory.clear();
    const r0: Vec2 = { x: 10, y: 0 };
    const r1: Vec2 = { x: -10, y: 0 };
    const pairPoints = [
        { id: "P1", branchIndex: 0, preferredWorld: { x: -11, y: 0 } },
    ];

    // First eval: No memory, but preferredWorld is near r1.
    const out = assignGenericIntersectionPairPoints(pairPoints, [r0, r1], ops);
    assert(out.get("P1") === r1, "PreferredWorld should override branchIndex on first evaluation");
}

// Test 4: Memory protection (no overwrite on null)
{
    stableMemory.clear();
    const r0: Vec2 = { x: 10, y: 10 };
    const r1: Vec2 = { x: 20, y: 20 };
    const p1 = { id: "P1", branchIndex: 0 };

    // Frame 1: Valid
    assignGenericIntersectionPairPoints([p1], [r0, r1], ops);
    assert(stableMemory.get("P1") === r0, "Memory should store r0");

    // Frame 2: All intersections disappear
    assignGenericIntersectionPairPoints([p1], [], ops);
    assert(stableMemory.get("P1") === r0, "Memory should NOT be cleared if intersections disappear");

    // Frame 3: Intersections reappear
    const r2: Vec2 = { x: 11, y: 11 };
    const r3: Vec2 = { x: 21, y: 21 };
    const out3 = assignGenericIntersectionPairPoints([p1], [r2, r3], ops);
    assert(out3.get("P1") === r2, "Should recover stability using old memory after a 'blind' frame");
}

console.log("intersection-stability tests: OK");
