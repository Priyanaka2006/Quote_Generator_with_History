# Stillword — Quote Generator with History

A responsive quote generator with an illustrated, nature-inspired reading space. It retrieves a random quote from [DummyJSON](https://dummyjson.com/docs/quotes) and saves each successful result in an IndexedDB database in the current browser.

## Run it

Open `index.html` in a browser, or serve the folder with any local static-file server. An internet connection is needed to retrieve new quotes and load the optional web fonts and landscape photograph.

## Features

- Fetch a fresh quote and author from the DummyJSON random-quotes API.
- Automatically save each fetched quote to the browser's IndexedDB history.
- Choose from three illustrated Stillword intentions to display and save a small reminder.
- Search saved quotes by quote text or author; select a saved thought to revisit it.
- Copy a quote, remove individual entries, or clear the collection.
- Responsive layout, keyboard shortcut (`/`) to focus history search, accessible status messages, and reduced-motion support.

Quotes are stored on this device only; this static app does not send history to a separate server. Clearing site data in the browser also clears the saved collection.
