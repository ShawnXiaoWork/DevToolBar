/**
 * GistService.js
 * 负责与 GitHub API 交互，管理用户配置的存储与读取。
 */

const GITHUB_API_BASE = 'https://api.github.com';
const CONFIG_FILENAME = 'dev_toolbar_config.json';

class GistService {
  constructor(token) {
    this.token = token;
  }

  get headers() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * 获取所有包含 DevToolBar 配置的 Gist 列表
   */
  async listConfigs() {
    const response = await fetch(`${GITHUB_API_BASE}/gists`, {
      headers: this.headers,
    });
    if (!response.ok) throw new Error('无法获取 Gist 列表');
    
    const gists = await response.json();
    // 过滤出包含我们特定配置文件的 Gist
    return gists.filter(gist => gist.files[CONFIG_FILENAME]);
  }

  /**
   * 读取特定 Gist 的配置内容
   * @param {string} gistId 
   */
  async loadConfig(gistId) {
    const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
      headers: this.headers,
    });
    if (!response.ok) throw new Error('无法读取配置详情');
    
    const gist = await response.json();
    const file = gist.files[CONFIG_FILENAME];
    return JSON.parse(file.content);
  }

  /**
   * 保存或更新配置
   * @param {string} description 描述（通常作为配置名）
   * @param {object} configData 配置对象
   * @param {string} gistId 如果提供，则更新现有 Gist；否则创建新 Gist
   */
  async saveConfig(description, configData, gistId = null) {
    const url = gistId ? `${GITHUB_API_BASE}/gists/${gistId}` : `${GITHUB_API_BASE}/gists`;
    const method = gistId ? 'PATCH' : 'POST';
    
    const payload = {
      description: `DevToolBar Config: ${description}`,
      public: false, // 默认设为私有
      files: {
        [CONFIG_FILENAME]: {
          content: JSON.stringify(configData, null, 2),
        },
      },
    };

    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('保存配置失败');
    return await response.json();
  }

  /**
   * 删除配置
   * @param {string} gistId 
   */
  async deleteConfig(gistId) {
    const response = await fetch(`${GITHUB_API_BASE}/gists/${gistId}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!response.ok) throw new Error('删除配置失败');
    return true;
  }
}

export default GistService;
