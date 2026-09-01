# Client Request Catalog — visual thesis

## Direction

**Dithered trade-print system.** This product is for businesses that still have
price sheets, bench notes, and repeat customers—not shiny consumer shops. The
interface borrows the deliberate imperfection of a two-colour trade catalogue:
coarse halftone dots, overprinted rules, stamped status chips, and generous
paper margins. It makes a quote-first request feel considered and private,
rather than like an abandoned checkout.

## Tokens

| Role | Light | Dark |
| --- | --- | --- |
| paper / background | `#f7f1e5` | `#171916` |
| surface | `#fffaf0` | `#222620` |
| ink | `#182319` | `#f7f1e5` |
| muted ink | `#536052` | `#c1c9bb` |
| moss accent | `#285238` | `#9fce99` |
| clay accent | `#a83f29` | `#ff9a7e` |
| warning | `#8a5700` | `#ffd381` |

The default is light paper; dark mode is a genuine inverted night ledger,
selected by the system preference. `#182319` on paper and paper on dark meet
the normal-text contrast requirement. Primary actions use moss with a dedicated
light/dark contrast token, so their text remains above 4.5:1 in both themes.

Typography pairs the self-host-free system **ui-monospace** for labels,
prices, and metadata (a durable order-pad feel) with **ui-rounded/system
sans-serif** for readable task copy. No network font is loaded. Sizes follow a
1.25 scale, body is 17px, and spacing uses an 4/8px rhythm, with 20–40px
breathing room around independent offers.

## Interaction and motion

The client sees one obvious verb per item: **Request a quote** or **Add fixed
price item**. A request tray rises from the lower edge, like a paper order
slip placed on a counter; its count changes immediately and submit becomes a
receipt. Owner actions are marked as operational controls, not mixed into the
client mode. Motion is a 180ms transform/opacity settle, never decorative or
looping. `prefers-reduced-motion` removes transforms and makes transitions
instant.

Mobile intentionally becomes a single-column catalogue with the request tray
in normal flow, so it cannot obscure actions. The dotted texture is CSS and
decorative; it is absent from the accessibility tree.

The public landing page uses the same trade-print grammar without exposing a
catalog or prices. The isolated demo adds a bordered ledger notice above the
catalog, with Reset demo and Start for real kept in that persistent strip.

## Original illustration plan and provenance

Hero art is an original, generated still-life: a stamped request slip, a
folding ruler, a spool, and product tags on warm recycled paper, rendered as a
two-ink dithered screen print. It is used only as an explanatory ambient image
in the client header, with a descriptive alt. Prompt sheet: close tabletop
still life; recycled cream paper, forest green ink, clay-red overprint;
editorial 50mm lens and soft window light; coarse halftone/dither texture;
no people, text, logos, watermark, brands, QR codes, or unreadable glyphs.

Generated imagery is original product artwork, disclosed in the footer. It was
generated on 2026-08-28 using the factory Azure AI Foundry `factory-image`
deployment; the exact final prompt and generation metadata are retained in
`assets/src/request-desk.png.json`. Responsive delivery uses 480, 720, and
960 px AVIF sources (12–64 KB), plus WebP fallbacks. Mobile receives the
smallest source that fits its pixel density.
