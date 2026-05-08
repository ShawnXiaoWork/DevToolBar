import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;
// 考虑到项目可能有 base 路径，自动获取当前 URL 所在的根目录作为 callback
const REDIRECT_URI = window.location.origin + window.location.pathname;

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('gh_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 1. 初始化检查 URL 中是否有 code (OAuth 回调)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !token) {
      handleCallback(code);
    } else if (token) {
      fetchUserInfo(token);
    }
  }, []);

  // 2. 将 code 换取 token
  const handleCallback = async (code) => {
    setLoading(true);
    try {
      // 使用 Cloudflare Worker 处理 Client Secret，保证前端安全
      const response = await fetch("https://githubdevyool.xiao19890526.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await response.json();

      if (data.access_token) {
        setToken(data.access_token);
        localStorage.setItem('gh_token', data.access_token);
        // 清除 URL 中的 code
        window.history.replaceState({}, document.title, REDIRECT_URI);
        fetchUserInfo(data.access_token);
      } else {
        throw new Error(data.error_description || data.error || '获取 Token 失败');
      }
    } catch (err) {
      setError(err.message);
      console.error('OAuth Callback Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. 获取用户信息
  const fetchUserInfo = async (accessToken) => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        // Token 可能过期或失效
        logout();
      }
    } catch (err) {
      console.error('Fetch User Info Error:', err);
    }
  };

  // 登录方法
  const login = () => {
    if (!CLIENT_ID) {
      alert('请先在 .env 中配置 VITE_GITHUB_CLIENT_ID');
      return;
    }
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=gist&redirect_uri=${REDIRECT_URI}`;
    window.location.href = oauthUrl;
  };

  // 登出方法
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('gh_token');
  };

  return (
    <AuthContext.Provider value={{ 
      token, user, loading, error, 
      login, logout, isLoggedIn: !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
