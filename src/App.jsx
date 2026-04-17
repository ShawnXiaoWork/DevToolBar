import React, { useState } from 'react'
import './App.css'
import { GameProvider } from './context/GameContext'
import Dictionary from './pages/Dictionary'
import MacroPanel from './pages/MacroPanel'
import FeatureConfig from './pages/FeatureConfig'
import Validation from './pages/Validation'

const Dashboard = () => (
  <div className="dashboard-container">
    <div className="glass-panel" style={{padding: '3rem', textAlign: 'center'}}>
      <h1 className="glow-text" style={{fontSize: '3.5rem', marginBottom: '1rem'}}>资源控制中心</h1>
      <p style={{fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto'}}>
        自上而下的数值规划工具，帮助您精准把控游戏经济系统的产出与消耗平衡。
      </p>
      
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginTop: '4rem'}}>
        <div style={{padding: '2rem', background: 'rgba(124, 77, 255, 0.1)', borderRadius: '16px', border: '1px solid var(--accent-primary)'}}>
          <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>⚖️</div>
          <h3>钻石本位</h3>
          <p style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>统一价值锚点</p>
        </div>
        <div style={{padding: '2rem', background: 'rgba(0, 229, 255, 0.1)', borderRadius: '16px', border: '1px solid var(--accent-secondary)'}}>
          <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>📈</div>
          <h3>动态分配</h3>
          <p style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>宏观阶段调控</p>
        </div>
        <div style={{padding: '2rem', background: 'rgba(0, 230, 118, 0.1)', borderRadius: '16px', border: '1px solid var(--accent-success)'}}>
          <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>🎯</div>
          <h3>目标倒推</h3>
          <p style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>微观数值落地</p>
        </div>
      </div>
    </div>
  </div>
)

function App() {
  const [activePage, setActivePage] = useState('dashboard')

  const renderPage = () => {
    switch(activePage) {
      case 'dashboard': return <Dashboard />
      case 'dictionary': return <Dictionary />
      case 'macro': return <MacroPanel />
      case 'feature': return <FeatureConfig />
      case 'validation': return <Validation />
      default: return <Dashboard />
    }
  }

  return (
    <GameProvider>
      <div className="app-container">
        <header className="header">
          <div className="logo">DevToolBar: Resource Control</div>
          <nav className="nav">
            <span className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>概览</span>
            <span className={`nav-link ${activePage === 'dictionary' ? 'active' : ''}`} onClick={() => setActivePage('dictionary')}>字典</span>
            <span className={`nav-link ${activePage === 'macro' ? 'active' : ''}`} onClick={() => setActivePage('macro')}>宏观</span>
            <span className={`nav-link ${activePage === 'feature' ? 'active' : ''}`} onClick={() => setActivePage('feature')}>功能</span>
            <span className={`nav-link ${activePage === 'validation' ? 'active' : ''}`} onClick={() => setActivePage('validation')}>验证</span>
          </nav>
        </header>
        
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </GameProvider>
  )
}

export default App
