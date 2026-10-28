import { describe, expect, it } from "vitest";
import {
  encodeCsv,
  parseCsv,
  rankEarlyItems,
  scoreEarlyRanking,
  type EarlyRankingItem,
  type RankingAnswerKey,
} from "./early-ranking";

function item(
  id: string,
  embedding: number[],
  publishedAt: string,
): EarlyRankingItem {
  return {
    id,
    title: id,
    summary: null,
    language: "en",
    url: `https://example.test/${id}`,
    publishedAt,
    embedding,
  };
}

describe("early ranking", () => {
  const items = [
    item("liked-a", [1, 0], "2026-01-01T00:00:00Z"),
    item("liked-b", [0, 1], "2026-01-02T00:00:00Z"),
    item("near-a", [0.99, 0.01], "2026-01-03T00:00:00Z"),
    item("middle", [0.7, 0.7], "2026-01-04T00:00:00Z"),
    item("near-b", [0.01, 0.99], "2026-01-05T00:00:00Z"),
  ];

  it("ranks by nearest liked and excludes feedback items", () => {
    expect(
      rankEarlyItems(items, ["liked-a", "liked-b"], "nearest-liked").map(
        ({ id }) => id,
      ),
    ).toEqual(["near-a", "near-b", "middle"]);
  });

  it("ranks against the mean liked vector", () => {
    expect(
      rankEarlyItems(items, ["liked-a", "liked-b"], "average-vector").map(
        ({ id }) => id,
      ),
    ).toEqual(["middle", "near-a", "near-b"]);
  });

  it("uses newest-first with deterministic ties", () => {
    expect(
      rankEarlyItems(items, ["liked-a"], "newest-first").map(({ id }) => id),
    ).toEqual(["near-b", "middle", "near-a", "liked-b"]);
  });

  it("round-trips CSV quotes, commas, and newlines", () => {
    const rows = [
      ["title", "summary"],
      ['A, "quoted" title', "line one\nline two"],
    ];
    expect(parseCsv(encodeCsv(rows))).toEqual(rows);
  });

  it("computes per-persona and macro precision@10 plus gate 1", () => {
    const key: RankingAnswerKey = {
      personas: {
        p1: {
          "nearest-liked": Array.from({ length: 10 }, (_, index) => ({
            blindId: `n${index}`,
            rank: index + 1,
          })),
          "average-vector": Array.from({ length: 10 }, (_, index) => ({
            blindId: `a${index}`,
            rank: index + 1,
          })),
          "newest-first": Array.from({ length: 10 }, (_, index) => ({
            blindId: `f${index}`,
            rank: index + 1,
          })),
        },
      },
    };
    const judgingRows = [
      ...Array.from({ length: 6 }, (_, index) => ({
        persona: "p1",
        blind_id: `n${index}`,
        relevant: "1",
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        persona: "p1",
        blind_id: `a${index}`,
        relevant: "1",
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        persona: "p1",
        blind_id: `f${index}`,
        relevant: "1",
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        persona: "p1",
        blind_id: `n${index + 6}`,
        relevant: "0",
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        persona: "p1",
        blind_id: `a${index + 5}`,
        relevant: "0",
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        persona: "p1",
        blind_id: `f${index + 4}`,
        relevant: "0",
      })),
    ];

    const result = scoreEarlyRanking(judgingRows, key);
    expect(result.macroAverage).toEqual({
      "nearest-liked": 0.6,
      "average-vector": 0.5,
      "newest-first": 0.4,
    });
    expect(result.gate1.passed).toBe(true);
  });
});
