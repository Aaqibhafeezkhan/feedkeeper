# Feed lists

People without feeds get a short list of well-known sources, sorted by interest (news, technology, Apple, …). Every list lives in one file, [`server/src/feeds/feedListsData.ts`](../server/src/feeds/feedListsData.ts). The web app and the native apps read it from `GET /api/v1/feed-lists`, so one change reaches all of them.

Suggestions are welcome: a new feed for a list, a feed that has gone quiet, or a whole new topic. Open a pull request that edits that file, or an issue if you would rather leave the editing to us.

## What belongs in a list

A list is a starting point, not a directory. Every entry has to earn its place:

- **Well known and useful to many.** A site that a lot of people in that language and field already follow. Niche blogs are better found through the "add by address" box.
- **Alive.** It published something in the last month, and keeps doing so.
- **A real feed.** The address serves RSS or Atom without a login. Paid sites are fine if the feed is readable for free, but say so in the pull request.
- **Not a near copy.** A list has room for a few good feeds per language (about three to five), not for every site on the topic. When two feeds overlap, the better known one stays.
- **One list.** A feed belongs to one list only.

## How to write an entry

```ts
{
  title: "The Verge",
  url: "https://www.theverge.com/rss/index.xml",
  lang: "en",
  description: {
    en: "Gadgets, tech and how they change culture.",
    de: "Geräte, Technik und ihr Einfluss auf die Kultur.",
    ja: "ガジェットとテクノロジー、その文化への影響。",
  },
},
```

- `title` is the name of the site alone: "The Verge", not "The Verge – tech news and reviews".
- `description` is one short line (up to 90 characters) saying what the site shows. All three languages are needed; if you cannot write Japanese or German, say so in the pull request and we will add it.
- `lang` is the language of the feed's content: `de`, `en` or `ja`.
- Use an `https` address without credentials.

A new list needs an `id` (lowercase letters, digits and dashes), a `title` and `description` in all three languages and an `iconSymbol`, the name of an [SF Symbol](https://developer.apple.com/sf-symbols/) that suits the folder the list creates.

## Checks

```bash
cd server && npx tsx --test test/feedLists.test.ts
```

The test checks that ids and addresses are unique, that every text exists in all three languages and stays short, and that titles carry no appendix. It cannot check that a site is still alive, so please open the address once and look at the date of the newest entry.

## For operators

A host that embeds the server can replace the lists with `setFeedListsProvider`. In the web app, `extensions.starterPacks` adds packs of your own (see [extending the web app](extending-the-web-app.md#starter-packs-and-welcome-content)).
