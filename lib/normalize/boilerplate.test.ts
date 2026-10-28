import { describe, expect, it } from "vitest";
import { removeYouTubeBoilerplate } from "./boilerplate";

/**
 * Representative YouTube `media:description` content in the shape of the
 * saved Engineering Explained fixture: a promo title line, a link line, a
 * subscribe line, the real description, a related-videos list, and affiliate
 * / social lines.
 */
const YOUTUBE_DESCRIPTION = [
  "Tesla Roadster Revealed: It Flies, It Kickflips, It Rockets! Right?",
  "Math From 6 Years Ago - https://youtu.be/4PRi4B1APj0",
  "Subscribe to Engineering Explained for more videos! - https://goo.gl/VZstk7",
  "",
  "Tesla has unveiled the new Roadster, and in classic Tesla fashion, they have",
  "some wild marketing stunts to go along with it. In this video we look at the",
  "three major stunts, in order.",
  "",
  "Related Videos: ",
  "Tesla Roadster Math From 6 Years Ago! https://youtu.be/4PRi4B1APj0",
  "Out of Spec Roadster Video - https://youtu.be/7oFL2ObpM08",
  "",
  "Recommended Books & Car Products - http://amzn.to/2BrekJm",
  "Engineering Explained is a participant in the Amazon Influencer Program.",
  "",
  "Don't forget to check out my other pages below!",
  "Merch: https://engineering-explained-shop.fourthwall.com",
  "Instagram: http://www.instagram.com/engineeringexplained",
].join("\n");

describe("removeYouTubeBoilerplate", () => {
  it("keeps the descriptive text", () => {
    const out = removeYouTubeBoilerplate(YOUTUBE_DESCRIPTION);
    expect(out).toContain("Tesla has unveiled the new Roadster");
    expect(out).toContain("some wild marketing stunts");
    expect(out).toContain("three major stunts, in order.");
    // The video's own headline is descriptive content, not boilerplate.
    expect(out).toContain("Tesla Roadster Revealed");
  });

  it("drops subscribe, related-video, affiliate, and social lines", () => {
    const out = removeYouTubeBoilerplate(YOUTUBE_DESCRIPTION);
    expect(out).not.toMatch(/subscribe/i);
    expect(out).not.toMatch(/related videos/i);
    expect(out).not.toContain("goo.gl");
    expect(out).not.toContain("amzn.to");
    expect(out).not.toMatch(/amazon influencer/i);
    expect(out).not.toMatch(/instagram/i);
    expect(out).not.toMatch(/merch/i);
    expect(out).not.toContain("fourthwall.com");
  });

  it("returns an empty string for empty input", () => {
    expect(removeYouTubeBoilerplate("")).toBe("");
  });

  it("leaves a purely descriptive text untouched", () => {
    const text = "A normal description of a video.\nSecond line.";
    expect(removeYouTubeBoilerplate(text)).toBe(text);
  });
});
