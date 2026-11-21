chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("index.html")
  });
});
async function configurePlayerHeaders() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],

    addRules: [
      {
        id: 1,
        priority: 1,

        condition: {
          initiatorDomains: [chrome.runtime.id],
          urlFilter: "|https://www.youtube.com/embed/",
          resourceTypes: ["sub_frame"]
        },

        action: {
          type: "modifyHeaders",
          requestHeaders: [
            {
              header: "Referer",
              operation: "set",
              value: `https://${chrome.runtime.id}/`
            }
          ]
        }
      }
    ]
  });
}

configurePlayerHeaders().catch(() => {
  console.error("Nie udało się skonfigurować odtwarzacza.");
});