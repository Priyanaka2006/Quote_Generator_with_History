const QUOTE_API_URL = "https://dummyjson.com/quotes/random";
const DATABASE_NAME = "stillword-quotes";
const DATABASE_VERSION = 1;
const STORE_NAME = "history";

const quoteText = document.querySelector("#quote-text");
const quoteAuthor = document.querySelector("#quote-author");
const quoteCount = document.querySelector("#quote-count");
const newQuoteButton = document.querySelector("#new-quote");
const newQuoteLabel = document.querySelector("#new-quote-label");
const copyQuoteButton = document.querySelector("#copy-quote");
const feedback = document.querySelector("#feedback");
const historyList = document.querySelector("#history-list");
const historyTotal = document.querySelector("#history-total");
const historySearch = document.querySelector("#history-search");
const clearHistoryButton = document.querySelector("#clear-history");
const intentionButtons = [...document.querySelectorAll(".intention-card")];

let database;
let currentQuote = null;
let requestInProgress = false;
let savingIntention = false;
let allHistory = [];

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Your browser does not support the local quote database."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: "historyId" });
      store.createIndex("savedAt", "savedAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the quote database."));
    request.onblocked = () => reject(new Error("The quote database is busy in another tab. Close that tab and try again."));
  });
}

function runTransaction(mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The quote database request failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The quote database transaction was interrupted."));
  });
}

function setFeedback(message, kind = "info") {
  feedback.textContent = message;
  feedback.dataset.kind = kind;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function renderHistory(quotes) {
  historyTotal.textContent = String(allHistory.length);
  historyTotal.setAttribute("aria-label", `${allHistory.length} saved ${allHistory.length === 1 ? "quote" : "quotes"}`);
  clearHistoryButton.disabled = allHistory.length === 0;

  if (quotes.length === 0) {
    const emptyMessage = historySearch.value.trim()
      ? `<strong>No matching thoughts</strong>Try another author or phrase.`
      : `<strong>A space for what stays.</strong>Your quotes will be saved here as you discover them.`;
    historyList.innerHTML = `<div class="history-empty">${emptyMessage}</div>`;
    historyList.setAttribute("aria-busy", "false");
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const quote of quotes) {
    const item = document.createElement("article");
    item.className = "history-item";

    const openButton = document.createElement("button");
    openButton.className = "history-item-main";
    openButton.type = "button";
    openButton.setAttribute("aria-label", `Show quote by ${quote.author}`);
    openButton.addEventListener("click", () => showSavedQuote(quote));

    const text = document.createElement("span");
    text.className = "history-quote";
    text.textContent = `“${quote.text}”`;

    const meta = document.createElement("span");
    meta.className = "history-meta";
    const author = document.createElement("span");
    author.textContent = quote.author;
    const date = document.createElement("span");
    date.textContent = formatDate(quote.savedAt);
    meta.append(author, date);
    openButton.append(text, meta);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-quote";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove quote by ${quote.author}`);
    removeButton.addEventListener("click", () => removeQuote(quote.historyId));

    item.append(openButton, removeButton);
    fragment.append(item);
  }

  historyList.replaceChildren(fragment);
  historyList.setAttribute("aria-busy", "false");
}

async function refreshHistory() {
  allHistory = (await runTransaction("readonly", (store) => store.getAll())).sort(
    (first, second) => second.savedAt - first.savedAt,
  );
  applyHistorySearch();
}

function applyHistorySearch() {
  const searchTerm = historySearch.value.trim().toLocaleLowerCase();
  const filteredHistory = searchTerm
    ? allHistory.filter((quote) =>
        `${quote.text} ${quote.author}`.toLocaleLowerCase().includes(searchTerm),
      )
    : allHistory;
  renderHistory(filteredHistory);
}

async function saveQuote(quote) {
  const entry = {
    ...quote,
    historyId: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  await runTransaction("readwrite", (store) => store.add(entry));
  currentQuote = entry;
  await refreshHistory();
}

function showSavedQuote(quote) {
  currentQuote = quote;
  quoteText.textContent = quote.text;
  quoteAuthor.textContent = quote.author;
  quoteText.setAttribute("aria-busy", "false");
  copyQuoteButton.disabled = false;
  quoteCount.textContent = `SAVED ${formatDate(quote.savedAt).toUpperCase()}`;
  setFeedback("Back to a thought you saved.");
}

async function fetchQuote() {
  if (requestInProgress || savingIntention) return;

  requestInProgress = true;
  newQuoteButton.disabled = true;
  intentionButtons.forEach((button) => {
    button.disabled = true;
  });
  newQuoteLabel.textContent = "Finding a thought...";
  quoteText.setAttribute("aria-busy", "true");
  setFeedback("");

  try {
    const response = await fetch(QUOTE_API_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`The quote service responded with ${response.status}. Please try again.`);
    }

    const result = await response.json();
    if (typeof result.quote !== "string" || typeof result.author !== "string") {
      throw new Error("The quote service returned an unexpected response. Please try again.");
    }

    quoteText.textContent = result.quote;
    quoteAuthor.textContent = result.author;
    quoteCount.textContent = "A THOUGHT FOR YOU";
    copyQuoteButton.disabled = false;
    await saveQuote({ apiId: result.id, text: result.quote, author: result.author });
    setFeedback("A new thought, saved to your collection.");
  } catch (error) {
    console.error("Could not get and save a quote:", error);
    quoteText.setAttribute("aria-busy", "false");
    if (currentQuote) {
      quoteText.textContent = currentQuote.text;
      quoteAuthor.textContent = currentQuote.author;
    } else {
      quoteText.textContent = "The words are taking the scenic route. Please try again in a moment.";
      quoteAuthor.textContent = "";
    }
    setFeedback(error instanceof Error ? error.message : "Could not get a quote. Please try again.", "error");
  } finally {
    requestInProgress = false;
    newQuoteButton.disabled = false;
    intentionButtons.forEach((button) => {
      button.disabled = false;
    });
    newQuoteLabel.textContent = "Find another thought";
  }
}

async function saveIntention(button) {
  if (requestInProgress || savingIntention || button.disabled) return;

  savingIntention = true;
  newQuoteButton.disabled = true;
  intentionButtons.forEach((intentionButton) => {
    intentionButton.disabled = true;
  });
  quoteText.setAttribute("aria-busy", "true");

  const text = button.dataset.intention;
  try {
    await saveQuote({ text, author: "Stillword" });
    quoteText.textContent = text;
    quoteAuthor.textContent = "Stillword";
    quoteCount.textContent = "A LITTLE REMINDER";
    copyQuoteButton.disabled = false;
    quoteText.setAttribute("aria-busy", "false");
    setFeedback("A little reminder, saved to your collection.");
  } catch (error) {
    console.error("Could not save the intention:", error);
    quoteText.setAttribute("aria-busy", "false");
    setFeedback("This reminder could not be saved. Please try again.", "error");
  } finally {
    savingIntention = false;
    newQuoteButton.disabled = false;
    intentionButtons.forEach((intentionButton) => {
      intentionButton.disabled = false;
    });
  }
}

async function removeQuote(historyId) {
  try {
    await runTransaction("readwrite", (store) => store.delete(historyId));
    await refreshHistory();
    setFeedback("Removed from your collection.");
  } catch (error) {
    console.error("Could not remove the saved quote:", error);
    setFeedback("That quote could not be removed. Please try again.", "error");
  }
}

async function clearHistory() {
  if (!allHistory.length || !window.confirm("Clear all saved quotes from this device? This cannot be undone.")) {
    return;
  }

  clearHistoryButton.disabled = true;
  try {
    await runTransaction("readwrite", (store) => store.clear());
    currentQuote = null;
    await refreshHistory();
    setFeedback("Your collection has been cleared.");
  } catch (error) {
    console.error("Could not clear the quote history:", error);
    setFeedback("Your collection could not be cleared. Please try again.", "error");
  } finally {
    clearHistoryButton.disabled = allHistory.length === 0;
  }
}

async function copyCurrentQuote() {
  if (!currentQuote) return;
  const copyText = `“${currentQuote.text}” — ${currentQuote.author}`;

  try {
    await navigator.clipboard.writeText(copyText);
    setFeedback("Quote copied to your clipboard.");
  } catch (error) {
    console.error("Could not copy the quote:", error);
    setFeedback("Clipboard access is unavailable. Select the quote to copy it.", "error");
  }
}

newQuoteButton.addEventListener("click", fetchQuote);
copyQuoteButton.addEventListener("click", copyCurrentQuote);
clearHistoryButton.addEventListener("click", clearHistory);
historySearch.addEventListener("input", applyHistorySearch);
intentionButtons.forEach((button) => {
  button.addEventListener("click", () => saveIntention(button));
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "")
  ) {
    event.preventDefault();
    historySearch.focus();
  }
});

async function startApp() {
  newQuoteButton.disabled = true;
  try {
    database = await openDatabase();
    await refreshHistory();
    intentionButtons.forEach((button) => {
      button.disabled = false;
    });
    await fetchQuote();
  } catch (error) {
    console.error("Stillword could not start:", error);
    historyList.innerHTML = '<div class="history-empty"><strong>Your collection is unavailable.</strong>Please try a current browser with local storage enabled.</div>';
    historyList.setAttribute("aria-busy", "false");
    setFeedback(error instanceof Error ? error.message : "The quote database could not be opened.", "error");
    if (database) newQuoteButton.disabled = false;
  }
}

startApp();
