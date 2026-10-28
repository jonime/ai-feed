# Feed fixtures

Raw XML captures of real feeds, used by the parse/normalize unit tests
(spec 001, task 5 / criterion 4). Captured with `curl` on **2026-10-28** —
item content (titles, dates, thumbnails) will drift over time, so tests only
assert against the first item of each feed.

| File                             | Source URL                                                                     | Format        | Notes                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------- |
| `yle-latest.xml`                 | https://yle.fi/rss/uutiset/tuoreimmat                                           | RSS 2.0       | Finnish; `?origin=rss` links; `<category>` tags; no `media:*` tags in items       |
| `bbc-world.xml`                  | https://feeds.bbci.co.uk/news/world/rss.xml                                    | RSS 2.0       | `?at_medium=RSS&at_campaign=rss` links; item-level `<media:thumbnail>`; no `<category>` tags |
| `theverge.xml`                   | https://www.theverge.com/rss/index.xml                                         | Atom          | `<summary>` + full `<content>` (summary must win); `<category term="…">`; no `media:*` tags in the current feed |
| `hackernews.xml`                 | https://news.ycombinator.com/rss                                               | RSS 2.0       | `<description>` is a bare "Comments" link (must normalize to an empty summary)    |
| `youtube-engineering-explained.xml` | https://www.youtube.com/feeds/videos.xml?channel_id=UClqhvGmHcvWL9w3R48t9QXQ | Atom (YouTube) | `<media:group>` with `media:thumbnail` and `media:description` (boilerplate source) |
