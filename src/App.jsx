import React, { useState } from 'react'
import './App.css'
import { GameProvider } from './context/GameContext'
import { AuthProvider } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Workbench from './pages/Workbench'
import AccountPanel from './components/Account/AccountPanel'

function App() {
  const [activePage, setActivePage] = useState('workbench')

  const renderPage = () => {
    switch(activePage) {
      case 'dashboard': return <Dashboard />
      case 'workbench': return <Workbench />
      default: return <Workbench />
    }
  }

  return (
    <AuthProvider>
      <GameProvider>
        <div className="app-container">
          <header className="header">
            <div className="logo-section">
              <div className="logo">DevToolBar: Resource Control</div>
            </div>
            
            <nav className="nav">
              <span className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>数据概览</span>
              <span className={`nav-link ${activePage === 'workbench' ? 'active' : ''}`} onClick={() => setActivePage('workbench')}>经济工作台</span>
            </nav>

            <div className="header-actions">
              <AccountPanel />
            </div>
          </header>
          
          <main className="main-content" style={{ padding: activePage === 'workbench' ? 0 : '2rem' }}>
            {renderPage()}
          </main>
        </div>
      </GameProvider>
    </AuthProvider>
  )
}

export default App
