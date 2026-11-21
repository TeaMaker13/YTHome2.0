(() => {
  const title = document.querySelector("#channel-title");
  const filterInput = document.querySelector("#channel-filter");
  const status = document.querySelector("#channel-status");
  const loadAllButton = document.querySelector("#load-all-videos");
  const results = document.querySelector("#channel-results");

  const channelId = new URLSearchParams(
    window.location.search
  ).get("channel");

  let apiKey = "";
  let uploadsId = "";
  let nextPageToken = "";
  let hasMore = true;
  let loading = false;
  let channelName = "";

  const videos = new Map();

  async function requestYouTube(endpoint, parameters) {
    const url = new URL(
      `https://www.googleapis.com/youtube/v3/${endpoint}`
    );

    url.search = new URLSearchParams({
      ...parameters,
      key: apiKey
    }).toString();

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;

      if (reason === "quotaExceeded") {
        throw new Error("Wyczerpano limit API projektu Google.");
      }

      throw new Error(`Zapytanie do YouTube nie powiodło się (${response.status}).`);
    }

    return data;
  }

  // Pobierz kolejną paczkę, maksymalnie 50 filmów.
  async function loadNextPage() {
    const parameters = {
      part: "snippet,contentDetails",
      playlistId: uploadsId,
      maxResults: "50"
    };

    if (nextPageToken) {
      parameters.pageToken = nextPageToken;
    }

    const data = await requestYouTube(
      "playlistItems",
      parameters
    );

    for (const item of data.items || []) {
      const id = item.contentDetails?.videoId;
      const thumbnail =
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url;

      // Pomijamy pozycje bez dostępnych danych filmu.
      if (!id || !thumbnail) continue;

      videos.set(id, {
        id,
        title: item.snippet.title,
        thumbnail,
        publishedAt:
          item.contentDetails.videoPublishedAt ||
          item.snippet.publishedAt
      });
    }

    nextPageToken = data.nextPageToken || "";
    hasMore = Boolean(nextPageToken);
  }

  function createCard(video) {
    const card = document.createElement("article");
    card.className = "channel-video";

    const thumbnail = document.createElement("img");
    thumbnail.src = video.thumbnail;
    thumbnail.alt = "";
    thumbnail.loading = "lazy";

    const information = document.createElement("div");
    const heading = document.createElement("h2");
    const link = document.createElement("a");

    const playerPage = new URL(
      chrome.runtime.getURL("player.html")
    );

    playerPage.searchParams.set("video", video.id);

    link.href = playerPage.toString();
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = video.title;

    heading.append(link);

    const date = document.createElement("p");
    const published = new Date(video.publishedAt);

    date.textContent = Number.isNaN(published.getTime())
      ? channelName
      : `${channelName} · ${published.toLocaleDateString("pl-PL")}`;

    information.append(heading, date);
    card.append(thumbnail, information);

    return card;
  }

  function renderVideos() {
    const phrase = filterInput.value
      .trim()
      .toLocaleLowerCase("pl-PL");

    const filteredVideos = [...videos.values()]
      .filter((video) =>
        video.title.toLocaleLowerCase("pl-PL").includes(phrase)
      )
      .sort((first, second) =>
        Date.parse(second.publishedAt) -
        Date.parse(first.publishedAt)
      );

    const fragment = document.createDocumentFragment();

    for (const video of filteredVideos) {
      fragment.append(createCard(video));
    }

    results.replaceChildren(fragment);

    status.textContent =
      `Wczytano: ${videos.size}. ` +
      `Pasuje do filtra: ${filteredVideos.length}.` +
      (loading ? " Pobieranie…" : "");
  }

  function updateButton() {
    loadAllButton.disabled = loading || !hasMore || !uploadsId;

    loadAllButton.textContent = loading
      ? "Wczytywanie…"
      : hasMore
        ? "Wczytaj wszystkie filmy"
        : "Wczytano wszystkie dostępne filmy";
  }

  async function initialize() {
    if (!channelId || !/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
      status.textContent = "Nieprawidłowy identyfikator kanału.";
      return;
    }

    loading = true;
    updateButton();

    try {
      const settings = await chrome.storage.local.get(
        "youtubeApiKey"
      );

      apiKey = settings.youtubeApiKey || "";

      if (!apiKey) {
        throw new Error(
          "Najpierw zapisz klucz API w ustawieniach strony głównej."
        );
      }

      const data = await requestYouTube("channels", {
        part: "snippet,contentDetails",
        id: channelId
      });

      const channel = data.items?.[0];

      if (!channel) {
        throw new Error("Nie znaleziono kanału.");
      }

      channelName = channel.snippet.title;
      title.textContent = channelName;
      document.title = channelName;

      uploadsId = channel.contentDetails.relatedPlaylists.uploads;

      // Dwie paczki po 50 = maksymalnie 100 pozycji na start.
      await loadNextPage();

      if (hasMore) {
        await loadNextPage();
      }

      loading = false;
      renderVideos();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      loading = false;
      updateButton();
    }
  }

  filterInput.addEventListener("input", renderVideos);

  loadAllButton.addEventListener("click", async () => {
    if (loading || !hasMore) return;

    loading = true;
    updateButton();
    renderVideos();

    try {
      while (hasMore) {
        await loadNextPage();
        renderVideos();
      }

      loading = false;
      renderVideos();
    } catch (error) {
      status.textContent =
        `Wczytano: ${videos.size}. ${error.message} ` +
        "Możesz ponowić pobieranie przyciskiem.";
    } finally {
      loading = false;
      updateButton();
    }
  });

  void initialize();
})();