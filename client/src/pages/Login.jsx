import React, { useState } from 'react'

export default function Login(){
  const [msg,setMsg]=useState('')
  const submit = async e =>{
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = Object.fromEntries(fd.entries())
    const res = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})
    const j = await res.json()
    if (j.error) return setMsg(j.error)
    localStorage.setItem('token', j.token)
    location.hash = '#/dashboard'
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={submit}>
        <label>Email<input name="email" type="email" required/></label>
        <label>Password<input name="password" type="password" required/></label>
        <button>Login</button>
      </form>
      <div className="msg">{msg}</div>
    </div>
  )
}
