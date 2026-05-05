import React, { useEffect, useState } from 'react'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'

function App(){
  const [route, setRoute] = useState(location.hash || '#/')
  useEffect(()=>{
    const onHash = ()=> setRoute(location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return ()=> window.removeEventListener('hashchange', onHash)
  },[])

  let view = null
  if (route.startsWith('#/register')) view = <Register />
  else if (route.startsWith('#/dashboard')) view = <Dashboard />
  else if (route.startsWith('#/')) view = <Home />
  else view = <Login />

  return (
    <div className="app">
      <header className="site-header">
        <div className="container">
          <div className="brand">My Project</div>
          <nav className="nav">
            <a href="#/">Home</a>
            <a href="#/login">Login</a>
            <a href="#/register">Register</a>
            <a href="#/dashboard">Dashboard</a>
          </nav>
        </div>
      </header>
      <main className="container" style={{paddingTop:20}}>{view}</main>
    </div>
  )
}

export default App
