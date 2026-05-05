import React from 'react'

export default function Home(){
  return (
    <section className="hero">
      <div className="hero-copy">
          <h1>Welcome to Heavy Machinery Rent Out Platform</h1>
          <p>This demo shows user registration, email verification, secure password hashing, and role-based access control for Customer, Owner, and Admin users.</p>
        <div style={{marginTop:16}}>
          <a className="btn" href="#/register">Register</a>
          <a style={{marginLeft:12}} href="#/login">Login</a>
        </div>
      </div>
      <div className="hero-media">
        <div className="card">
          <h3>Quick Demo</h3>
          <p>Create an account, open the verification link, then sign in to explore role-specific features.</p>
        </div>
      </div>
    </section>
  )
}
