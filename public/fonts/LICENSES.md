# Bundled fonts — licences

All three families here are licensed under the **SIL Open Font License 1.1**, which
permits bundling and self-hosting, including in commercial products, as long as the
licence travels with the files and the fonts are not sold on their own. None is
modified: these are the unmodified woff2 subsets as published by Google Fonts.

| Files | Family | Licence | Source |
|---|---|---|---|
| `elmessiri-*-{arabic,latin}.woff2` | El Messiri | OFL 1.1 | https://fonts.google.com/specimen/El+Messiri |
| `plexarabic-*-{arabic,latin}.woff2` | IBM Plex Sans Arabic | OFL 1.1 | https://fonts.google.com/specimen/IBM+Plex+Sans+Arabic |
| `plexlatin-*-latin.woff2` | IBM Plex Sans | OFL 1.1 | https://fonts.google.com/specimen/IBM+Plex+Sans |

Full licence text: https://openfontlicense.org/

The Arabic and Latin files are separate subsets of the same family; `src/design/fonts.ts`
explains why they are loaded as separate families rather than one.