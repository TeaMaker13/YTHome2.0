const settingsDialog = document.querySelector("#settings-dialog");
const openSettingsButton = document.querySelector("#open-settings");
const closeSettingsButton = document.querySelector("#close-settings");

openSettingsButton.addEventListener("click", () => {
  settingsDialog.showModal();
});

closeSettingsButton.addEventListener("click", () => {
  settingsDialog.close();
});

const apiKeyInput = document.querySelector("#api-key");
const saveSettingsButton = document.querySelector("#save-settings");

// Wczytaj wcześniej zapisany klucz.
chrome.storage.local.get("youtubeApiKey", (result) => {
  apiKeyInput.value = result.youtubeApiKey || "";
});

// Zapisz klucz po kliknięciu przycisku.
saveSettingsButton.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();

  chrome.storage.local.set({ youtubeApiKey: apiKey }, () => {
    if (chrome.runtime.lastError) {
      alert("Nie udało się zapisać klucza. Spróbuj ponownie.");
      return;
    }

    alert("Zapisano klucz API.");
  });
});

const searchForm = document.querySelector("#search-form");
const searchQueryInput = document.querySelector("#search-query");
const searchButton = document.querySelector("#search-button");
const searchStatus = document.querySelector("#search-status");
const searchResults = document.querySelector("#search-results");

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = searchQueryInput.value.trim();

  if (!query) {
    searchStatus.textContent = "Wpisz, czego szukasz.";
    return;
  }

  searchButton.disabled = true;
  searchResults.replaceChildren();
  searchStatus.textContent = "Wyszukiwanie…";

  try {
    const settings = await chrome.storage.local.get("youtubeApiKey");
    const apiKey = settings.youtubeApiKey;

    if (!apiKey) {
      searchStatus.textContent = "Najpierw zapisz klucz API w ustawieniach.";
      return;
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/search");

    url.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: "10",
      key: apiKey
    }).toString();

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;

      if (reason === "quotaExceeded") {
        throw new Error("Wyczerpano limit API projektu Google.");
      }

      throw new Error(
        `YouTube odrzucił zapytanie (kod ${response.status}). ` +
        "Sprawdź klucz, jego ograniczenia i włączenie YouTube Data API v3."
      );
    }

    const videos = data.items || [];

    for (const video of videos) {
      const videoId = video.id?.videoId;

      if (!videoId) continue;

      const card = document.createElement("article");
      card.className = "video-card";

      const title = document.createElement("h3");
      const link = document.createElement("a");

      link.href =
        `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = video.snippet.title;

      title.append(link);

      const channel = document.createElement("p");
      channel.textContent = video.snippet.channelTitle;

      card.append(title, channel);
      searchResults.append(card);
    }

    searchStatus.textContent = searchResults.childElementCount
      ? `Wyświetlono filmów: ${searchResults.childElementCount}.`
      : "Nie znaleziono filmów.";
  } catch (error) {
    searchStatus.textContent = error instanceof TypeError
      ? "Nie udało się połączyć z API. Sprawdź internet i uprawnienia rozszerzenia."
      : error.message;
  } finally {
    searchButton.disabled = false;
  }
});