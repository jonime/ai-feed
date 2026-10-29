"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { clearFeedback, setFeedback } from "../feedback/actions";
import { loadMoreFeed } from "./actions";
import {
  FeedbackMutationQueue,
  type FeedbackKind,
  type FeedbackQueueSnapshot,
  type FeedbackState,
} from "../../lib/feedback-queue";
import {
  explanationForFeedItem,
  formatRelativeTime,
  safeHttpUrl,
  type FeedItem,
} from "../../lib/feed-ui";
import {
  beginSwipe,
  finishSwipe,
  moveSwipe,
  type SwipeGesture,
} from "../../lib/swipe-gesture";

const pageSize = 30;
const maximumItems = 1000;

function RefreshFeedButton() {
  return (
    <form action="/" method="get">
      <button className="button button-secondary refresh-button" type="submit">
        Refresh feed
      </button>
    </form>
  );
}

function FeedCard({
  item,
  onUndo,
  renderedAt,
}: {
  item: FeedItem;
  onUndo: (restore: () => void) => void;
  renderedAt: string;
}) {
  const [snapshot, setSnapshot] = useState<FeedbackQueueSnapshot>({
    confirmed: null,
    displayed: null,
    saving: false,
    error: null,
  });
  const [gesture, setGesture] = useState<SwipeGesture | null>(null);
  const queueRef = useRef<FeedbackMutationQueue | null>(null);
  const gestureRef = useRef<SwipeGesture | null>(null);
  const suppressClick = useRef(false);
  if (queueRef.current === null) {
    queueRef.current = new FeedbackMutationQueue(
      null,
      async (state: FeedbackState) => {
        if (state) {
          await setFeedback(item.id, state.kind, state.via);
        } else {
          await clearFeedback(item.id);
        }
      },
      setSnapshot,
    );
  }
  function chooseAction(
    kind: FeedbackKind,
    via: "button" | "swipe" = "button",
  ) {
    const queue = queueRef.current;
    if (!queue) return;
    const previous = queue.snapshot.displayed;
    const next = previous?.kind === kind ? null : { kind, via };
    queue.enqueue(next);
    if (via === "swipe" || (next !== null && kind !== "like")) {
      onUndo(() => queue.enqueue(previous));
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    const nextGesture = beginSwipe(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect().width,
    );
    gestureRef.current = nextGesture;
    setGesture(nextGesture);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const currentGesture = gestureRef.current;
    if (!currentGesture) return;
    const nextGesture = moveSwipe(currentGesture, event.clientX, event.clientY);
    gestureRef.current = nextGesture;
    setGesture(nextGesture);
    if (nextGesture.lock === "horizontal") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onPointerUp() {
    const currentGesture = gestureRef.current;
    if (!currentGesture) return;
    const result = finishSwipe(currentGesture);
    gestureRef.current = null;
    setGesture(null);
    if (result.action) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      chooseAction(result.action, "swipe");
    }
  }

  function onPointerCancel() {
    gestureRef.current = null;
    setGesture(null);
  }

  function onClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  }

  const collapsed =
    snapshot.displayed?.kind === "not_interested" ||
    snapshot.displayed?.kind === "seen";

  const itemUrl = safeHttpUrl(item.url);
  const thumbnailUrl = safeHttpUrl(item.thumbnail_url);
  const swipeDelta = gesture?.lock === "horizontal" ? gesture.deltaX : 0;
  const revealOpacity = gesture
    ? Math.min(1, Math.abs(swipeDelta) / (gesture.width * 0.4 || 1))
    : 0;
  const cardStyle: CSSProperties = {
    transform: swipeDelta ? `translateX(${swipeDelta}px)` : undefined,
    transition: gesture ? "none" : undefined,
  };

  return (
    <div className="swipe-frame" hidden={collapsed}>
      {swipeDelta !== 0 && (
        <div
          className={`swipe-reveal ${swipeDelta > 0 ? "swipe-reveal-like" : "swipe-reveal-dismiss"}`}
          style={{ opacity: revealOpacity }}
          aria-hidden="true"
        >
          {swipeDelta > 0 ? "👍 Like" : "👎 Not interested"}
        </div>
      )}
      <article
        className="feed-item"
        data-feed-item-id={item.id}
        aria-busy={snapshot.saving}
        style={cardStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        {thumbnailUrl && (
          <img
            className="feed-thumbnail"
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="feed-item-content">
          <p className="feed-item-meta">
            <span>{item.source_name}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.published_at}>
              {formatRelativeTime(item.published_at, new Date(renderedAt))}
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
          {item.summary && <p className="feed-item-summary">{item.summary}</p>}
          <p className="feed-explanation">{explanationForFeedItem(item)}</p>
          <div className="feed-actions" aria-label="Rate this item">
            <button
              className="feedback-button"
              type="button"
              aria-label="Like"
              aria-pressed={snapshot.displayed?.kind === "like"}
              onClick={() => chooseAction("like")}
            >
              <span aria-hidden="true">👍</span> Like
            </button>
            <button
              className="feedback-button"
              type="button"
              aria-label="Not interested"
              aria-pressed={snapshot.displayed?.kind === "not_interested"}
              onClick={() => chooseAction("not_interested")}
            >
              <span aria-hidden="true">👎</span> Not interested
            </button>
            <button
              className="feedback-button"
              type="button"
              aria-label="Seen"
              aria-pressed={snapshot.displayed?.kind === "seen"}
              onClick={() => chooseAction("seen")}
            >
              <span aria-hidden="true">✓</span> Seen
            </button>
          </div>
          {snapshot.error && (
            <p className="auth-error" role="alert">
              {snapshot.error}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

export default function FeedList({
  initialItems,
  renderedAt,
}: {
  initialItems: FeedItem[];
  renderedAt: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length === pageSize);
  const [loading, setLoading] = useState(false);
  const [requestMore, setRequestMore] = useState(false);
  const [error, setError] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    itemId: string;
    restore: () => void;
  } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (!hasMore || items.length >= maximumItems) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setRequestMore(true);
    });
    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, items.length]);

  useEffect(() => {
    if (!requestMore || !hasMore || loading || requestInFlight.current) return;

    const requestedLimit = Math.min(pageSize, maximumItems - items.length);
    requestInFlight.current = true;
    setRequestMore(false);
    setLoading(true);
    setError(false);

    void loadMoreFeed(items.map((item) => item.id))
      .then((nextItems) => {
        setItems((currentItems) => {
          const knownIds = new Set(currentItems.map((item) => item.id));
          const uniqueItems = nextItems.filter(
            (item) => !knownIds.has(item.id),
          );
          return [...currentItems, ...uniqueItems].slice(0, maximumItems);
        });
        setHasMore(
          nextItems.length === requestedLimit &&
            items.length + nextItems.length < maximumItems,
        );
      })
      .catch(() => setError(true))
      .finally(() => {
        requestInFlight.current = false;
        setLoading(false);
      });
  }, [hasMore, items, loading, requestMore]);

  const atMaximum = items.length >= maximumItems;
  const caughtUp = !hasMore && !atMaximum;

  useEffect(() => {
    if (!undoToast) return;
    const timeout = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(timeout);
  }, [undoToast]);

  return (
    <>
      {items.length === 0 ? (
        <p className="feed-empty">No new items right now.</p>
      ) : (
        <div className="feed-list">
          {items.map((item) => (
            <FeedCard
              item={item}
              renderedAt={renderedAt}
              key={item.id}
              onUndo={(restore) => setUndoToast({ itemId: item.id, restore })}
            />
          ))}
        </div>
      )}
      {error && (
        <p className="auth-error" role="alert">
          Could not load more items. Please try again.
        </p>
      )}
      {undoToast && (
        <div className="undo-toast" role="status">
          <span>Feedback updated</span>
          <button
            className="undo-button"
            type="button"
            onClick={() => {
              undoToast.restore();
              setUndoToast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
      {hasMore && !atMaximum ? (
        <div className="feed-pagination">
          <div className="feed-sentinel" ref={sentinelRef} aria-hidden="true" />
          <button
            className="button button-secondary load-more-button"
            type="button"
            disabled={loading}
            onClick={() => setRequestMore(true)}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : (
        <div className="feed-end" role="status">
          <p>
            {atMaximum
              ? "Refresh to see more items."
              : caughtUp
                ? "You're all caught up."
                : "No new items right now."}
          </p>
          <RefreshFeedButton />
        </div>
      )}
    </>
  );
}
