# Gellix (licensed font)

Gellix is a commercial typeface and is not part of this repository. Without it the app uses Figtree.

To use it, place licensed files here under these names and rebuild the app:

- `Gellix-Regular.woff2` (400)
- `Gellix-Medium.woff2` (500)
- `Gellix-SemiBold.woff2` (600)
- `Gellix-Bold.woff2` (700)

The layout checks for `Gellix-Regular.woff2` at build time and only then declares the font, so no
request is made for files that are not there. This repository is public: commit the files only if
your licence allows web use and redistribution in a public repository.
