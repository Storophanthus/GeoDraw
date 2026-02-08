export type Vec2 = { x: number; y: number };

export const v = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s }),
};
