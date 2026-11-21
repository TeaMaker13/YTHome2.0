(() => {
  const results = document.querySelector("#subscriptions-results");
  const status = document.querySelector("#subscriptions-status");

  // Wyślij zapytanie do YouTube.
  async function requestYouTube(endpoint, parameters, apiKey) {
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

      throw new Error(
        `Błąd API (${response.status}). Sprawdź klucz i dostęp do API.`
      );
    }

    return data;
  }

  // Odczytaj @nazwę z wpisu użytkownika.
  function getHandle(entry) {
    const text = entry.trim();

    if (/^@[^/\s?#]+$/.test(text)) {
      return text;
    }

    try {
      const url = new URL(text);

      const allowedHosts = [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com"
      ];

      if (
        !["https:", "http:"].includes(url.protocol) ||
        !allowedHosts.includes(url.hostname)
      ) {
        throw new Error();
      }

      const handle = decodeURIComponent(
        url.pathname.split("/")[1] || ""
      );

      if (!/^@[^/\s?#]+$/.test(handle)) {
        throw new Error();
      }

      return handle;
    } catch {
      throw new Error(
        "Użyj @nazwy lub adresu https://www.youtube.com/@nazwa."
      );
    }
  }

  // Zamień czas YouTube, np. PT2M15S, na sekundy.
  function getDurationSeconds(duration) {
    const match = (duration || "").match(
      /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/
    );

    if (!match) return null;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }

  // Utwórz kartę filmu.
  function createVideoCard(video) {
    const card = document.createElement("article");
    card.className = "video-card";

    const thumbnailUrl =
      video.snippet.thumbnails?.medium?.url ||
      video.snippet.thumbnails?.default?.url;

    if (thumbnailUrl) {
      const thumbnail = document.createElement("img");
      thumbnail.src = thumbnailUrl;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";

      card.append(thumbnail);
    }

    const title = document.createElement("h3");
    const link = document.createElement("a");

    const playerPage = new URL(
      chrome.runtime.getURL("player.html")
    );

    playerPage.searchParams.set("video", video.id);

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

    card.append(title, channel);

    return card;
  }

  // Wczytaj osobny rząd filmów dla każdego kanału.
  async function loadSubscriptions() {
    results.replaceChildren();
    status.textContent = "Wczytywanie filmów z kanałów…";

    try {
      const settings = await chrome.storage.local.get([
        "youtubeApiKey",
        "subscribedChannels"
      ]);

      const apiKey = settings.youtubeApiKey;
      const channels = settings.subscribedChannels || [];

      if (!apiKey) {
        status.textContent = "Dodaj klucz API w ustawieniach.";
        return;
      }

      if (channels.length === 0) {
        status.textContent =
          "Dodaj obserwowane kanały w ustawieniach.";
        return;
      }

      const checkedChannels = new Set();
      let displayedChannels = 0;
      let failedChannels = 0;

      for (const entry of channels) {
        let section;

        try {
          const handle = getHandle(entry);

          const channelData = await requestYouTube(
            "channels",
            {
              part: "snippet,contentDetails",
              forHandle: handle
            },
            apiKey
          );

          const channel = channelData.items?.[0];

          if (!channel) {
            throw new Error(`Nie znaleziono kanału: ${handle}`);
          }

          // Nie pokazuj tego samego kanału dwukrotnie.
          if (checkedChannels.has(channel.id)) continue;
          checkedChannels.add(channel.id);

          section = document.createElement("section");
          section.className = "channel-section";
const heading = document.createElement("h3");
const channelLink = document.createElement("a");

const channelPage = new URL(
  chrome.runtime.getURL("channel.html")
);

channelPage.searchParams.set("channel", channel.id);

channelLink.href = channelPage.toString();
channelLink.target = "_blank";
channelLink.rel = "noopener";
channelLink.textContent = channel.snippet.title;

heading.append(channelLink);

          const row = document.createElement("div");
          row.className = "channel-videos";
          row.setAttribute(
            "aria-label",
            `Filmy kanału ${channel.snippet.title}`
          );

          section.append(heading, row);
          results.append(section);

          const uploadsId =
            channel.contentDetails.relatedPlaylists.uploads;

          // Pobierz ostatnie 50 pozycji kanału.
          const uploads = await requestYouTube(
            "playlistItems",
            {
              part: "contentDetails",
              playlistId: uploadsId,
              maxResults: "50"
            },
            apiKey
          );

          const ids = [
            ...new Set(
              (uploads.items || [])
                .map((item) => item.contentDetails?.videoId)
                .filter(Boolean)
            )
          ];

          let videos = [];

          if (ids.length > 0) {
            const details = await requestYouTube(
              "videos",
              {
                part: "snippet,contentDetails",
                id: ids.join(",")
              },
              apiKey
            );

            videos = details.items || [];
          }

          const latestVideos = videos
            .filter((video) => {
              const seconds = getDurationSeconds(
                video.contentDetails?.duration
              );

              // Pozostaw nieznaną długość lub ponad minutę.
              return seconds == null || seconds > 60;
            })
            .sort((first, second) => {
              return (
                Date.parse(second.snippet.publishedAt) -
                Date.parse(first.snippet.publishedAt)
              );
            })
            .slice(0, 30);

          for (const video of latestVideos) {
            row.append(createVideoCard(video));
          }

          if (latestVideos.length === 0) {
            const message = document.createElement("p");
            message.textContent =
              "Brak filmów spełniających filtr " +
              "w ostatnich 50 publikacjach.";

            row.append(message);
          }

          displayedChannels++;
        } catch (error) {
          failedChannels++;

          const message = document.createElement("p");
          message.textContent = `${entry}: ${error.message}`;

          if (section) {
            section.append(message);
          } else {
            results.append(message);
          }
        }
      }

      status.textContent =
        `Wczytano kanałów: ${displayedChannels}.`;

      if (failedChannels > 0) {
        status.textContent +=
          ` Nie udało się wczytać: ${failedChannels}.`;
      }
    } catch (error) {
      status.textContent =
        `Nie udało się wczytać filmów: ${error.message}`;
    }
  }

  // Uruchom po otwarciu lub odświeżeniu strony.
  void loadSubscriptions();
})();