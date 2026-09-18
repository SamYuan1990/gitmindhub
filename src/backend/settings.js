// src/backend/settings.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// 配置文件路径：系统用户目录下的 gitmindhub_settings.json
const SETTINGS_PATH = path.join(app.getPath('userData'), 'gitmindhub_settings.json');

// 默认配置
const DEFAULT_SETTINGS = {
  apiKey: '', // 留空，让用户在 UI 里填
  embeddingUrl: 'http://localhost:9080/embeddings',
  systemPrompt: 'You are a helpful assistant. You manage context like a Git version control system. Always be concise and clear.',
  provider: 'deepseek',
  modelId: 'deepseek-v4-flash'
};

// 读取配置
function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      // 合并默认配置，防止新增字段时旧配置文件缺失
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[Settings] ❌ 读取配置失败，使用默认配置:', error.message);
  }
  return { ...DEFAULT_SETTINGS };
}

// 保存配置
function saveSettings(newSettings) {
  try {
    // 确保目录存在
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 合并并写入
    const finalSettings = { ...DEFAULT_SETTINGS, ...newSettings };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(finalSettings, null, 2), 'utf-8');
    console.log(`[Settings] ✅ 配置已保存至: ${SETTINGS_PATH}`);
    return finalSettings;
  } catch (error) {
    console.error('[Settings] ❌ 保存配置失败:', error);
    throw error;
  }
}

module.exports = { getSettings, saveSettings, SETTINGS_PATH };