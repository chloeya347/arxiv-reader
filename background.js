function isValidPage(url) {
  // console.log("HEELOLLLO");
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.pathname.toLowerCase().endsWith('.pdf')){
      // console.log("TRUE");
      return true;
    }
    if (u.hostname === 'arxiv.org' &&
        (u.pathname.startsWith('/pdf/') || u.pathname.startsWith('/abs/'))) {
          // console.log("TRUE");
          return true;
        }
    return false;
  } catch {
    return false;
  }
}

async function updateActionState(tab) {
  if (!tab?.id || tab.id < 0) return;
  const valid = isValidPage(tab.url);
  if (valid) {
    chrome.action.enable(tab.id);
    await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true }).catch(() => {});
  } else {
    chrome.action.disable(tab.id);
    await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: false }).catch(() => {});
  }
}

// Disable the icon for all tabs by default
chrome.action.disable();

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url !== undefined || changeInfo.status === 'complete') {
    updateActionState(tab);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => updateActionState(tab));
});
