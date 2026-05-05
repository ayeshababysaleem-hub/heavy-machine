import React, { useState } from 'react'

export default function Register(){
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(false)
  const submit = async e =>{
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = Object.fromEntries(fd.entries())
    // basic client-side validation
    if (!data.email || !data.password || !data.role) return setMsg('Please fill required fields.')
    if (data.password.length < 6) return setMsg('Password must be at least 6 characters.')
    setLoading(true)
    try{
      const res = await fetch('/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})
      let j = null
      try{ j = await res.json() }catch(e){ }
      if (!res.ok) return setMsg((j && j.error) ? j.error : ('Request failed: '+res.status))
      if (j && j.error) return setMsg(j.error)
      if (j && j.preview) try{ window.open(j.preview, '_blank') }catch(e){}
      setMsg('Registered. Check email. ' + (j && j.preview? 'Preview: '+j.preview : (j && j.verifyUrl? j.verifyUrl : '')))
      setTimeout(()=> location.hash = '#/login', 2000)
    }catch(err){
      setMsg('Network error: '+(err.message||err))
    }finally{ setLoading(false) }
  }

  return (
    <div className="card">
      <h2>Register</h2>
        <form onSubmit={submit}>
        <label>Name<input name="name"/></label>
        <label>Email<input name="email" type="email" required/></label>
        <label>Password<input name="password" type="password" required/></label>
        <label>Role<select name="role"><option>Customer</option><option>Owner</option><option>Admin</option></select></label>
        <button disabled={loading}>{loading? 'Registering…' : 'Register'}</button>
      </form>
      <div className="msg">{msg}</div>
    </div>
  )
}
