import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStickerLayout,
  STICKER_SHEET_PROFILES,
  validateStickerLayout,
} from "../src/lib/sticker-layout.js";

const samplesCm = [
  [2, 2],
  [3, 4],
  [5, 5],
  [5, 7],
  [7, 10],
  [10, 15],
];

function validateWithinRedArea(layout, gapMm) {
  const local = layout.placements.map((item) => ({
    ...item,
    x: item.x - layout.allowed.x,
    y: item.y - layout.allowed.y,
  }));
  return validateStickerLayout(local, layout.allowed.width, layout.allowed.height, gapMm);
}

test("uses the PDF page sizes and red vector regions as the A4/A3 limits", () => {
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A4.widthMm - 225) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A4.heightMm - 320) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A4.allowed.width - 190) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A4.allowed.height - 275) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A3.widthMm - 320) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A3.heightMm - 450) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A3.allowed.width - 285) < 0.01);
  assert.ok(Math.abs(STICKER_SHEET_PROFILES.A3.allowed.height - 405) < 0.01);
  for (const profile of Object.values(STICKER_SHEET_PROFILES)) {
    for (const [x, y, markWidth, markHeight] of profile.marks) {
      const overlapsAllowed = x < profile.allowed.x + profile.allowed.width
        && x + markWidth > profile.allowed.x
        && y < profile.allowed.y + profile.allowed.height
        && y + markHeight > profile.allowed.y;
      assert.equal(overlapsAllowed, false, `${profile.id} laser mark must stay outside the red area`);
    }
  }
});

for (const [widthCm, heightCm] of samplesCm) {
  for (const sheetId of ["A4", "A3"]) {
    test(`fits ${widthCm} × ${heightCm} cm on ${sheetId} without crossing or overlapping`, () => {
      const result = calculateStickerLayout({
        profile: STICKER_SHEET_PROFILES[sheetId],
        stickerWidthMm: widthCm * 10,
        stickerHeightMm: heightCm * 10,
        gapMm: 0.1,
        allowRotation: true,
      });
      assert.equal(result.verified, true);
      assert.equal(result.count, result.placements.length);
      assert.ok(result.count > 0);
      assert.equal(validateWithinRedArea(result, 0.1).valid, true);
    });
  }
}

test("rotation can improve an asymmetric sticker layout", () => {
  const profile = STICKER_SHEET_PROFILES.A4;
  const normal = calculateStickerLayout({ profile, stickerWidthMm: 50, stickerHeightMm: 70, gapMm: 0.1, allowRotation: false });
  const rotatable = calculateStickerLayout({ profile, stickerWidthMm: 50, stickerHeightMm: 70, gapMm: 0.1, allowRotation: true });
  assert.ok(rotatable.count > normal.count);
  assert.equal(rotatable.orientation, "Mista");
});

test("combines original and rotated rows when that fills the sheet better", () => {
  const result = calculateStickerLayout({
    profile: STICKER_SHEET_PROFILES.A4,
    stickerWidthMm: 30,
    stickerHeightMm: 40,
    gapMm: 0.1,
    allowRotation: true,
  });
  assert.equal(result.orientation, "Mista");
  assert.equal(validateWithinRedArea(result, 0.1).valid, true);
});

test("rejects overlaps and a gap smaller than configured", () => {
  const overlap = validateStickerLayout([
    { x: 0, y: 0, width: 20, height: 20 },
    { x: 19.9, y: 0, width: 20, height: 20 },
  ], 100, 100, 0.1);
  assert.equal(overlap.valid, false);
  assert.match(overlap.reason, /sobrepõem/);

  const smallGap = validateStickerLayout([
    { x: 0, y: 0, width: 20, height: 20 },
    { x: 20.05, y: 0, width: 20, height: 20 },
  ], 100, 100, 0.1);
  assert.equal(smallGap.valid, false);
  assert.match(smallGap.reason, /espaçamento/);
});

test("keeps added paper and laser safety insets inside the reference red area", () => {
  const profile = STICKER_SHEET_PROFILES.A4;
  const result = calculateStickerLayout({
    profile,
    stickerWidthMm: 20,
    stickerHeightMm: 20,
    gapMm: 0.1,
    allowRotation: true,
    insets: { left: 1, right: 2, top: 3, bottom: 4 },
  });
  assert.equal(result.allowed.x, profile.allowed.x + 1);
  assert.equal(result.allowed.y, profile.allowed.y + 3);
  assert.equal(result.allowed.width, profile.allowed.width - 3);
  assert.equal(result.allowed.height, profile.allowed.height - 7);
  assert.equal(validateWithinRedArea(result, 0.1).valid, true);
});
