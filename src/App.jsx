import React, { useState } from 'react'
import './App.css'
import { GameProvider } from './context/GameContext'
import Dashboard from './pages/Dashboard'
import Workbench from './pages/Workbench'

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
    <GameProvider>
      <div className="app-container">
        <header className="header">
          <div className="logo">DevToolBar: Resource Control</div>
          <nav className="nav">
            <span className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>数据概览</span>
            <span className={`nav-link ${activePage === 'workbench' ? 'active' : ''}`} onClick={() => setActivePage('workbench')}>经济工作台</span>
          </nav>
        </header>
        
        <main className="main-content" style={{ padding: activePage === 'workbench' ? 0 : '2rem' }}>
          {renderPage()}
        </main>
      </div>
    </GameProvider>
  )
}

export default App
