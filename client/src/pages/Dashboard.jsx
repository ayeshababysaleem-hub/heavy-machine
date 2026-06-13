import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Dashboard(){
  const [user,setUser]=useState(null)
  const [msg,setMsg]=useState('')
  const [machines,setMachines]=useState([])
  const [page,setPage]=useState(1)
  const [limit,setLimit]=useState(6)
  const [total,setTotal]=useState(0)
  useEffect(()=>{ load() }, [])
  async function load(){
    const token = localStorage.getItem('token')
    if (token) {
      try{
        const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } })
        if (res.ok) {
          const j = await res.json(); setUser(j)
        } else {
          setUser(null)
        }
      }catch(e){ setUser(null) }
    } else {
      setUser(null)
    }
    // Always load machines (guests may view availability)
    await loadMachines(1)
    // load return reminders for logged-in customers
    if (localStorage.getItem('token')) loadReminders()
  }

  const [reminders, setReminders] = useState([])
  async function loadReminders(){
    try{
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await axios.get('/api/my/returns', { headers: { Authorization: 'Bearer ' + token } })
      const data = res.data && res.data.data ? res.data.data : []
      setReminders(data || [])
    }catch(e){
      // fail silently; do not use alert()
      console.error('Failed to load return reminders', e)
    }
  }

  async function loadMachines(p=1){
    const q = encodeURIComponent(query || '')
    const type = encodeURIComponent(typeFilter || '')
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: 'Bearer ' + token } : {}
    const res = await fetch(`/api/machines?q=${q}&type=${type}&page=${p}&limit=${limit}`, { headers })
    if (!res.ok) return
    const js = await res.json()
    setMachines(js.data || [])
    setTotal(js.total || 0)
    setPage(js.page || p)
  }
  // search/filter state
  const [query,setQuery] = useState('')
  const [typeFilter,setTypeFilter] = useState('')
  const types = Array.from(new Set(machines.map(m=>m.type))).sort()
  const filtered = machines.filter(m => {
    if (typeFilter && m.type !== typeFilter) return false
    if (query && !(m.name.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase()))) return false
    return true
  })
  async function admin(){
    const token = localStorage.getItem('token')
    const res = await fetch('/api/admin', { headers: { Authorization: 'Bearer ' + token } })
    const j = await res.json(); alert(JSON.stringify(j))
  }

  // Owner actions: add / edit / delete
  const [showAdd,setShowAdd] = useState(false)
  const [newName,setNewName] = useState('')
  const [newType,setNewType] = useState('')
  const [newImage,setNewImage] = useState('')
  const [newImageFile,setNewImageFile] = useState(null)
  const [newDesc,setNewDesc] = useState('')

  async function addMachine(){
    const token = localStorage.getItem('token')
    if (!token) return alert('Not authorized')
    let res
    if (newImageFile){
      const fd = new FormData()
      fd.append('name', newName)
      fd.append('type', newType)
      fd.append('description', newDesc)
      fd.append('image', newImageFile)
      res = await fetch('/api/machines',{ method:'POST', headers:{ 'authorization':'Bearer '+token }, body: fd })
    } else {
      res = await fetch('/api/machines',{ method:'POST', headers:{ 'content-type':'application/json','authorization':'Bearer '+token }, body: JSON.stringify({ name:newName, type:newType, image:newImage, description:newDesc }) })
    }
    if (!res.ok) return alert('Failed to add')
    setNewName(''); setNewType(''); setNewImage(''); setNewDesc(''); setShowAdd(false)
    await loadMachines(page)
  }

  async function editMachine(m){
    const token = localStorage.getItem('token')
    if (!token) return alert('Not authorized')
    const name = prompt('Name', m.name); if (name===null) return
    const type = prompt('Type', m.type); if (type===null) return
    const desc = prompt('Description', m.description); if (desc===null) return
    const img = prompt('Image URL (leave blank to keep)', m.image)
    const res = await fetch('/api/machines/'+m.id, { method:'PUT', headers:{ 'content-type':'application/json','authorization':'Bearer '+token }, body: JSON.stringify({ name, type, description: desc, image: img }) })
    if (!res.ok) return alert('Failed to update')
    await loadMachines(page)
  }

  async function deleteMachine(m){
    const ok = confirm('Delete '+m.name+'?'); if (!ok) return
    const token = localStorage.getItem('token')
    if (!token) return alert('Not authorized')
    const res = await fetch('/api/machines/'+m.id, { method:'DELETE', headers:{ 'authorization':'Bearer '+token } })
    if (!res.ok) return alert('Failed to delete')
    await loadMachines(page)
  }

  return (
    <div className="card">
      <h2>Dashboard</h2>
      {msg && <div className="msg">{msg}</div>}
      {user && (
        <div>
          <p>Name: {user.name}</p>
          <p>Email: {user.email}</p>
          <p>Role: {user.role}</p>
          {user.role === 'Admin' && <button onClick={admin}>Admin Action</button>}
          <button onClick={()=>{ localStorage.removeItem('token'); location.hash = '#/login' }}>Logout</button>
        </div>
      )}

      {/* Return Reminder Cards */}
      {reminders && reminders.length > 0 && (
        <section style={{marginTop:18}}>
          <h3>Return Reminders</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:8}}>
            {reminders.map(r => {
              const days = r.remainingDays
              const isOverdue = (typeof days === 'number' && days < 0)
              const isDueSoon = (typeof days === 'number' && days >= 0 && days <= 2)
              const bg = isOverdue ? 'linear-gradient(90deg, rgba(255,70,70,0.06), rgba(255,70,70,0.02))' : (isDueSoon ? 'linear-gradient(90deg, rgba(251,191,36,0.06), rgba(251,191,36,0.02))' : 'linear-gradient(90deg, rgba(59,130,246,0.04), rgba(59,130,246,0.01))')
              const border = isOverdue ? '1px solid rgba(255,70,70,0.2)' : (isDueSoon ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(59,130,246,0.08)')
              return (
                <div key={r.id} className="card" style={{padding:12,background:bg,borderRadius:8,border}}> 
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:'0.85rem',color:'#94a3b8'}}>Machine</div>
                      <div style={{fontWeight:700,fontSize:'1rem'}}>{r.machineName || r.machineId}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'0.85rem',color:'#94a3b8'}}>Return Date</div>
                      <div style={{fontWeight:700,fontSize:'1rem'}}>{r.endDate}</div>
                    </div>
                  </div>
                  <div style={{marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontSize:'0.9rem',color:isOverdue? '#ef4444': (isDueSoon? '#f59e0b' : '#3b82f6')}}>
                      {isOverdue ? 'Overdue' : (isDueSoon ? `Due in ${days} day${days===1?'':'s'}` : `Remaining ${days} day${days===1?'':'s'}`)}
                    </div>
                    <div>
                      <button onClick={() => { location.href = '/booking.html?bookingId=' + r.id }} style={{padding:'6px 10px',borderRadius:8}}>View</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section style={{marginTop:18}}>
        <h3>Available Machinery</h3>
        <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search machinery..." style={{flex:1,padding:10,borderRadius:8,border:'1px solid #e6edf3'}} />
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{padding:10,borderRadius:8,border:'1px solid #e6edf3'}}>
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {(user && (user.role === 'Owner' || user.role === 'Admin')) && (
          <div style={{marginTop:12}}>
            <button onClick={()=>setShowAdd(s=>!s)}>{showAdd? 'Close' : 'Add Machine'}</button>
            {showAdd && (
              <div style={{marginTop:8,display:'grid',gap:8}}>
                <input placeholder="Name" value={newName} onChange={e=>setNewName(e.target.value)} />
                <input placeholder="Type" value={newType} onChange={e=>setNewType(e.target.value)} />
                <input placeholder="Image URL" value={newImage} onChange={e=>setNewImage(e.target.value)} />
                <textarea placeholder="Description" value={newDesc} onChange={e=>setNewDesc(e.target.value)} />
                <div><button onClick={addMachine}>Add</button></div>
              </div>
            )}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginTop:12}}>
          {filtered.map(m => (
            <div key={m.id} className="card">
              {(() => {
                const isGuestOrCustomer = !user || (user && user.role === 'Customer');
                const status = (m.status === 'booked') ? 'Available' : (isGuestOrCustomer ? 'Available' : (m.status || ''));
                let bg = '#6b7280';
                if (status === 'Available' || status === 'approved') bg = '#16a34a';
                else if (status === 'booked') bg = '#ef4444';
                else if (status === 'pending') bg = '#f59e0b';
                else if (status === 'rejected') bg = '#6b7280';
                return status ? (<div style={{fontSize:'0.8rem',padding:6,borderRadius:6,background: bg,display:'inline-block',color:'#fff',marginBottom:8}}>{status}</div>) : null;
              })()}
              <img src={m.image} alt={m.name} style={{width:'100%',borderRadius:8,marginBottom:8}} />
              <h4>{m.name}</h4>
              <p style={{color:'#6b7280'}}>{m.description}</p>
              <p style={{color:'#94a3b8',marginTop:6,fontSize:'0.95rem'}}>
                {m.type} • {m.model || ''} • {m.location || ''}
                <span style={{marginLeft:8}}>{(typeof m.price !== 'undefined' && m.price !== null && m.price !== '') ? ('₨ ' + Number(m.price).toFixed(2)) : '—'}</span>
              </p>
              {/* Booking controls */}

              {(user && (user.role === 'Admin' || user.id === m.ownerId)) && (
                <div style={{marginTop:8}}>
                  <button onClick={()=>editMachine(m)} style={{marginRight:8}}>Edit</button>
                  <button onClick={()=>deleteMachine(m)}>Delete</button>
                  {user.role === 'Admin' && (
                    <button style={{marginLeft:8}} onClick={async ()=>{
                      const token = localStorage.getItem('token')
                      if (!token) return alert('Not authorized')
                      const res = await fetch('/api/machines/'+m.id+'/verify', { method: 'POST', headers: { 'content-type':'application/json','authorization':'Bearer '+token }, body: JSON.stringify({ action: 'approve' }) })
                      if (!res.ok) return alert('Failed to approve')
                      await loadMachines(page)
                    }}>Approve</button>
                  )}
                </div>
              )}
              {/* Show Book button to logged-in Customers when machine is approved and they are not the owner */}
              {((!user || user.role === 'Customer') && (!(user && user.id === m.ownerId))) && (
                <div style={{marginTop:8}}>
                  <button onClick={()=>{ const params = new URLSearchParams({ machineId: m.id }); location.href = '/booking.html?' + params.toString(); }}>Book</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>{ if (page>1) loadMachines(page-1) }}>Prev</button>
          <div>Page {page} — {Math.ceil(total/limit)||1}</div>
          <button onClick={()=>{ if (page < Math.ceil(total/limit)) loadMachines(page+1) }}>Next</button>
        </div>
      </section>
    </div>
  )
}
