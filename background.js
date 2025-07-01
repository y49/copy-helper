// background.js – Web Limits Remover  Service-Worker
const DEFAULT_SETTINGS = {
  autoRemove: true,
  floatingCopy: false
};
const INJECT_FILES = ['inject.js'];          // 将被注入到 MAIN world

/* ------------ 安装 / 更新 ------------ */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
});

/* ------------ 统一消息路由 ------------ */
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  switch (req.action) {
    /* 读取设置 */
    case 'getSettings':
      chrome.storage.sync.get(DEFAULT_SETTINGS, (st) =>
        sendResponse({ success: true, settings: st })
      );
      break;

    /* 更新设置并广播所有标签页 */
    case 'updateSettings':
      chrome.storage.sync.set(req.settings, () => {
        chrome.tabs.query({}, (tabs) =>
          tabs.forEach((t) =>
            chrome.tabs.sendMessage(t.id, {
              action: 'updateSettings',
              settings: req.settings
            }).catch(() => {})
          )
        );
        sendResponse({ success: true });
      });
      break;

    /* 让 content.js 注入 Web-Limits-Remover 到 MAIN world */
    case 'injectWLR':
      chrome.scripting.executeScript(
        {
          target: { tabId: sender.tab.id, allFrames: true },
          world: 'MAIN',
          files: INJECT_FILES
        },
        () => sendResponse({ success: true })
      );
      break;

    /* 让页面进入手动选择模式 */
    case 'startElementSelection':
      chrome.tabs.sendMessage(sender.tab.id, { action: 'startElementSelection' });
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  return true;                 // 异步回应
});
