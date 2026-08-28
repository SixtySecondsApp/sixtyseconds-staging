# Generated faces for mocked artefacts

**Nobody in this folder is real.** Every image is a StyleGAN-generated face
(thispersondoesnotexist.com, 24 Aug 2026), curated from a pool of 140 pulls.

## Why generated rather than stock

Andrew asked for real profile pictures instead of letter initials, and free
stock was the first instinct. The Unsplash and Pexels licences permit
commercial use but explicitly do **not** guarantee model releases for
identifiable people, and "a real face beside invented engagement data on a
commercial page" is the exact use those carve-outs exist for.

That matters more here than on a normal site. On the same day these were made
we pulled three real companies and a named real prospect off the homepage hero,
and established that we cannot say who is in several of our own HeyGen renders.
Adding 23 more unattributable real faces would have been the same mistake in a
new place. A generated face has no model release to need, because there is no
model.

## Rules

- **Only ever on artefacts marked "Example, not a customer".** These faces make
  a mock look like a real product screen, which is the point — and also the
  risk. A face turns a schematic into a customer list. The marker is what keeps
  that honest, so the two ship together or not at all.
- **Never on a real person's row.** Anything describing an actual customer,
  employee or prospect uses a real photograph or nothing.
- **One face per NAME, sitewide.** Priya is the same face on every page she
  appears on. Two photographs for one name across sibling pages reads as
  sloppiness.
- Curated for adults only — the raw generator returns children and they were
  excluded — and for a mixed cast that matches the names in use.

## Files

23 faces, 160x160 JPEG, ~8KB each, **scaled from the full 1024 frame with no
crop**:

aisha · ana · ben · cole · dan · daniel · ellie · ingrid · james · kate · kit ·
leo · marco · maya · nina · noah · owen · priya · rosa · sam · sarah · tom · zara

## Do not crop these

The first version centre-cropped to 800/1024 to "tighten on the face". It
clipped skulls and chins and pushed several faces off-centre. The source images
are FFHQ-aligned — the head is already positioned with correct headroom and
shoulders, which is exactly the framing a round avatar wants. Any crop fights
that alignment. If a tighter face is ever needed, re-align from the source
rather than centre-cropping the output.

## Known gap

**`femi` is missing.** Femi appears on the investor board and needs a Black
male face; the pool of 140 produced exactly one suitable (`daniel`), already
used on index. Either pull more from the generator until a second lands, or
leave that row on its initial — `initLoopList` falls back cleanly.

## Wiring

`SIXTY.initLoopList` takes `pfp` per row and keeps the initial underneath as
the fallback for a 404, a slow load, or a text-only reader:

```js
{name:'Priya', sub:'Northbank Group', pfp:'../media/faces/priya.jpg'}
```

Rows that are companies rather than people must pass no `pfp`.
