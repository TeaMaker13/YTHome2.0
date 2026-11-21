const params = new URLSearchParams(window.location.search);
const videoId = params.get("video");

const container = document.querySelector("#player-container");
const status = document.querySelector("#player-status");

if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
  status.textContent = "Nieprawidłowy identyfikator filmu.";
} else {
  const player = document.createElement("iframe");

  const playerUrl = new URL(
    `https://www.youtube.com/embed/${videoId}`
  );

  playerUrl.searchParams.set("autoplay", "0");
  playerUrl.searchParams.set("controls", "1");
  playerUrl.searchParams.set("playsinline", "1");

  player.src = playerUrl.toString();
  player.title = "Odtwarzacz filmu YouTube";
  player.allow = "encrypted-media; fullscreen; picture-in-picture";
  player.allowFullscreen = true;
  player.referrerPolicy = "strict-origin-when-cross-origin";

  container.append(player);
}