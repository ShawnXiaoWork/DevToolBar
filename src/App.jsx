import React, { useState } from 'react'
import './App.css'
import { GameProvider } from './context/GameContext'
import Dictionary from './pages/Dictionary'
import MacroPanel from './pages/MacroPanel'
import FeatureConfig from './pages/FeatureConfig'
import Validation from './pages/Validation'
import Dashboard from './pages/Dashboard'

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
