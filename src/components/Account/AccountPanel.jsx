import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import GistService from '../../services/GistService';
import './AccountPanel.css';

const AccountPanel = () => {
  const { user, token, logout, login, isLoggedIn } = useAuth();
  const { state, dispatch } = useGame();
  
  const [gists, setGists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    if (isLoggedIn && token) {
      fetchGists();
    }
  }, [isLoggedIn, token]);

  const fetchGists = async () => {
    setLoading(true);
    try {
      const service = new GistService(token);
      const list = await service.listConfigs();
      setGists(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToCloud = async () => {
    const configName = prompt('输入配置名称:', state.projectName || '新配置');
    if (!configName) return;

    setLoading(true);
    try {
      const service = new GistService(token);
      await service.saveConfig(configName, state);
      setSyncMsg('保存成功！');
      fetchGists();
      setTimeout(() => setSyncMsg(''), 3000);
    } catch (err) {
      alert('保存失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGist = async (gistId) => {
    if (!confirm('确定要加载此配置吗？当前未保存的修改将被覆盖。')) return;
    
    setLoading(true);
    try {
      const service = new GistService(token);
      const config = await service.loadConfig(gistId);
      dispatch({ type: 'IMPORT_STATE', payload: config });
      setSyncMsg('加载成功！');
      setIsPanelOpen(false);
      setTimeout(() => setSyncMsg(''), 3000);
    } catch (err) {
      alert('加载失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGist = async (e, gistId) => {
    e.stopPropagation();
    if (!confirm('确定删除此云端配置吗？')) return;
    
    try {
      const service = new GistService(token);
      await service.deleteConfig(gistId);
      fetchGists();
    } catch (err) {
      alert('删除失败');
    }
  };

  return (
    <div className="account-section">
      {!isLoggedIn ? (
        <button className="login-btn-github" onClick={login}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"></path></svg>
          登录 GitHub 同步
        </button>
      ) : (
        <div className="user-profile-mini" onClick={() => setIsPanelOpen(!isPanelOpen)}>
          <img src={user?.avatar_url} alt="avatar" />
          <span className="user-name">{user?.login}</span>
        </div>
      )}

      {isPanelOpen && isLoggedIn && (
        <div className="account-dropdown">
          <div className="dropdown-header">
            <h4>云端配置管理</h4>
            <button className="close-btn" onClick={() => setIsPanelOpen(false)}>&times;</button>
          </div>
          
          <div className="dropdown-content">
            <button className="save-current-btn" onClick={handleSaveToCloud}>
              + 保存当前配置到云端
            </button>
            
            <div className="gist-list">
              {loading ? <p className="loading-text">读取中...</p> : (
                gists.length === 0 ? <p className="empty-text">暂无云端记录</p> : (
                  gists.map(gist => (
                    <div key={gist.id} className="gist-item" onClick={() => handleLoadGist(gist.id)}>
                      <div className="gist-info">
                        <span className="gist-name">{gist.description.replace('DevToolBar Config: ', '')}</span>
                        <span className="gist-date">{new Date(gist.updated_at).toLocaleDateString()}</span>
                      </div>
                      <button className="delete-gist-btn" onClick={(e) => handleDeleteGist(e, gist.id)}>
                        删除
                      </button>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
          
          <div className="dropdown-footer">
            <button className="logout-btn" onClick={logout}>退出登录</button>
          </div>
        </div>
      )}

      {syncMsg && <div className="toast-msg">{syncMsg}</div>}
    </div>
  );
};

export default AccountPanel;
