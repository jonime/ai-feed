"use client";

import { useState } from "react";
import Link from "next/link";
import { clearFeedback } from "../feedback/actions";
import {
  formatRelativeTime,
  safeHttpUrl,
  type LikedFeedItem,
} from "../../lib/feed-ui";

export default function LikedList({
  initialItems,
  renderedAt,
}: {
  initialItems: LikedFeedItem[];
  renderedAt: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function unlike(itemId: string) {
    if (pendingId) return;
    setPendingId(itemId);
    setError(false);
    try {
      await clearFeedback(itemId);
      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== itemId),
      );
    } catch {
      setError(true);
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="liked-empty">
        <p>No liked items yet.</p>
        <Link href="/">Browse your feed</Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="auth-error" role="alert">
          Could not remove this like. Please try again.
        </p>
      )}
      <div className="feed-list liked-list">
        {items.map((item) => {
          const itemUrl = safeHttpUrl(item.url);
          const thumbnailUrl = safeHttpUrl(item.thumbnail_url);
          return (
            <article className="liked-item" key={item.id}>
              {thumbnailUrl && (
                <img
                  className="feed-thumbnail"
                  src={thumbnailUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="liked-item-content">
                <p className="feed-item-meta">
                  <span>{item.source_name}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={item.liked_at}>
                    Liked{" "}
                    {formatRelativeTime(item.liked_at, new Date(renderedAt))}
                  </time>
                </p>
                <h3 className="feed-item-title">
                  {itemUrl ? (
                    <a href={itemUrl} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                {item.summary && (
                  <p className="feed-item-summary">{item.summary}</p>
                )}
                <button
                  className="feedback-button"
                  type="button"
                  aria-label={`Unlike ${item.title}`}
                  disabled={pendingId !== null}
                  onClick={() => void unlike(item.id)}
                >
                  Unlike
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
