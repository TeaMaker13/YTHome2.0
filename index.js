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
const subscribedChannelsInput = document.querySelector(
  "#subscribed-channels"
);

// Wczytaj zapisany klucz i listę kanałów.
chrome.storage.local.get(
  ["youtubeApiKey", "subscribedChannels"],
  (result) => {
    if (chrome.runtime.lastError) {
      alert("Nie udało się wczytać ustawień.");
      return;
    }

    apiKeyInput.value = result.youtubeApiKey || "";

    subscribedChannelsInput.value =
      (result.subscribedChannels || []).join("\n");
  }
);

// Zapisz oba ustawienia jednym przyciskiem.
saveSettingsButton.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();

  const channels = subscribedChannelsInput.value
    .split("\n")
    .map((channel) => channel.trim())
    .filter((channel) => channel !== "");

  const uniqueChannels = [...new Set(channels)];

  chrome.storage.local.set(
    {
      youtubeApiKey: apiKey,
      subscribedChannels: uniqueChannels
    },
    () => {
      if (chrome.runtime.lastError) {
        alert("Nie udało się zapisać ustawień.");
        return;
      }

      subscribedChannelsInput.value = uniqueChannels.join("\n");

      alert("Zapisano ustawienia.");
    }
  );
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
      maxResults: "30",
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

  const foundVideos = data.items || [];
let videos = foundVideos;

if (foundVideos.length > 0) {
  const videoIds = foundVideos
    .map((video) => video.id?.videoId)
    .filter(Boolean);

  if (videoIds.length > 0) {
    const detailsUrl = new URL(
      "https://www.googleapis.com/youtube/v3/videos"
    );

    detailsUrl.search = new URLSearchParams({
      part: "contentDetails",
      id: videoIds.join(","),
      key: apiKey
    }).toString();

    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    if (!detailsResponse.ok) {
      throw new Error(
        `Nie udało się pobrać długości filmów ` +
        `(kod ${detailsResponse.status}). Spróbuj ponownie.`
      );
    }

    const durations = new Map();

    for (const video of detailsData.items || []) {
      durations.set(
        video.id,
        durationToSeconds(video.contentDetails.duration)
      );
    }

    videos = foundVideos.filter((video) => {
      const seconds = durations.get(video.id?.videoId);

      // Zachowaj film, jeśli długość jest nieznana
      // albo film trwa więcej niż minutę.
      return seconds == null || seconds > 60;
    });
  }
}
    for (const video of videos) {
      const videoId = video.id?.videoId;

      if (!videoId) continue;

      const card = document.createElement("article");
      card.className = "video-card";

      const title = document.createElement("h3");
      const link = document.createElement("a");

const playerPage = new URL(
  chrome.runtime.getURL("player.html")
);

playerPage.searchParams.set("video", videoId);

link.href = playerPage.toString();
link.target = "_blank";
link.rel = "noopener";
link.textContent = video.snippet.title;
      title.append(link);

   const channel = document.createElement("p");
const channelNameLink = document.createElement("a");

const channelAddress = new URL(
  chrome.runtime.getURL("channel.html")
);

channelAddress.searchParams.set(
  "channel",
  video.snippet.channelId
);

channelNameLink.href = channelAddress.toString();
channelNameLink.target = "_blank";
channelNameLink.rel = "noopener";
channelNameLink.textContent = video.snippet.channelTitle;

channel.append(channelNameLink);

    const thumbnail = document.createElement("img");

thumbnail.src = video.snippet.thumbnails.medium.url;
thumbnail.alt = "";
thumbnail.loading = "lazy";

card.append(thumbnail, title, channel);
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
function durationToSeconds(duration) {
  const match = duration.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/
  );

  if (!match) return null;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}