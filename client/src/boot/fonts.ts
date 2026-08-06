// Self-hosted webfonts. Importing the latin subsets only keeps the payload small
// and avoids any external request, so there is no third-party dependency at
// runtime and no flash of unstyled text from a slow CDN.
//
// Inter            -> body / UI text
// Barlow Condensed -> display headings (athletic, condensed)

import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'

import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
