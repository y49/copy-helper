// popup.js
document.addEventListener('DOMContentLoaded', async function() {
    const autoRemoveCheckbox = document.getElementById('autoRemove');
    const floatingCopyCheckbox = document.getElementById('floatingCopy');
    const manualCopyBtn = document.getElementById('manualCopy');
    const statusDiv = document.getElementById('status');
    
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 加载设置
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get({
                autoRemove: true,
                floatingCopy: false
            });
            
            autoRemoveCheckbox.checked = result.autoRemove;
            floatingCopyCheckbox.checked = result.floatingCopy;
            
            updateStatus();
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }
    
    // 保存设置
    async function saveSettings() {
        try {
            await chrome.storage.sync.set({
                autoRemove: autoRemoveCheckbox.checked,
                floatingCopy: floatingCopyCheckbox.checked
            });
            
            // 通知content script更新设置
            chrome.tabs.sendMessage(tab.id, {
                action: 'updateSettings',
                settings: {
                    autoRemove: autoRemoveCheckbox.checked,
                    floatingCopy: floatingCopyCheckbox.checked
                }
            }).catch(() => {
                // 忽略错误，可能是页面还没加载完成
            });
            
            updateStatus();
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }
    
    // 更新状态显示
    function updateStatus() {
        if (autoRemoveCheckbox.checked || floatingCopyCheckbox.checked) {
            statusDiv.textContent = '✅ 插件已启用';
            statusDiv.className = 'status enabled';
        } else {
            statusDiv.textContent = '❌ 插件已禁用';
            statusDiv.className = 'status disabled';
        }
    }
    
    // 手动复制功能
    async function startManualCopy() {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startElementSelection'
            });
            window.close();
        } catch (error) {
            console.error('启动手动复制失败:', error);
            // 如果content script未注入，尝试注入
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                
                setTimeout(async () => {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'startElementSelection'
                    });
                    window.close();
                }, 100);
            } catch (injectError) {
                console.error('注入脚本失败:', injectError);
                alert('无法在此页面使用该功能，请刷新页面后重试');
            }
        }
    }
    
    // 事件监听
    autoRemoveCheckbox.addEventListener('change', saveSettings);
    floatingCopyCheckbox.addEventListener('change', saveSettings);
    manualCopyBtn.addEventListener('click', startManualCopy);
    
    // 初始化
    await loadSettings();
});