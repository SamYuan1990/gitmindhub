// src/backend/settings.js
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'gitmindhub_settings.json');

const DEFAULT_EMBEDDING_CONFIG = {
  provider: 'local', // 'local' | 'ollama' | 'siliconflow' | 'modelscope'
  url: 'http://localhost:9080/embeddings',
  apiKey: '',
  model: 'Qwen/Qwen3-Embedding-0.6B'
};

const DEFAULT_SETTINGS = {
  systemPrompt: 'You are a helpful assistant. You manage context like a Git version control system.',
  embeddingConfig: DEFAULT_EMBEDDING_CONFIG,
  llmProfiles: [
    {
      id: 'default_deepseek',
      name: 'DeepSeek V4 Flash',
      provider: 'deepseek',
      modelId: 'deepseek-v4-flash',
      apiKey: '',
      isDefault: true
    }
  ]
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      let settings = JSON.parse(data);
      
      // 🌟 兼容旧版配置 1：迁移旧的 LLM apiKey
      if (settings.apiKey && !settings.llmProfiles) {
        settings.llmProfiles = [{
          id: 'migrated_default', name: 'Migrated Default',
          provider: settings.provider || 'deepseek', modelId: settings.modelId || 'deepseek-v4-flash',
          apiKey: settings.apiKey, isDefault: true
        }];
        delete settings.apiKey; delete settings.provider; delete settings.modelId;
      }

      // 🌟 兼容旧版配置 2：迁移旧的 embeddingUrl
      if (settings.embeddingUrl && !settings.embeddingConfig) {
        settings.embeddingConfig = {
          provider: 'local',
          url: settings.embeddingUrl,
          apiKey: '',
          model: 'Qwen/Qwen3-Embedding-0.6B'
        };
        delete settings.embeddingUrl;
      }
      
      // 如果连 embeddingConfig 都没有，初始化一个
      if (!settings.embeddingConfig) {
        settings.embeddingConfig = DEFAULT_EMBEDDING_CONFIG;
      }

      return { ...DEFAULT_SETTINGS, ...settings };
    }
  } catch (error) {
    console.error('[Settings] ❌ 读取配置失败:', error.message);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(newSettings) {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const finalSettings = { ...DEFAULT_SETTINGS, ...newSettings };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(finalSettings, null, 2), 'utf-8');
    return finalSettings;
  } catch (error) {
    console.error('[Settings] ❌ 保存配置失败:', error);
    throw error;
  }
}

function getProfileById(profileId) {
  const settings = getSettings();
  return settings.llmProfiles.find(p => p.id === profileId);
}

function getDefaultProfile() {
  const settings = getSettings();
  return settings.llmProfiles.find(p => p.isDefault) || settings.llmProfiles[0];
}

module.exports = { getSettings, saveSettings, getProfileById, getDefaultProfile, SETTINGS_PATH };