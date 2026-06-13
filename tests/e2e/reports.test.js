const request = require('supertest');
const jwt = require('jsonwebtoken');
const knex = require('../../db');
const { expect } = require('chai');
const app = require('../../server').app;

describe('admin reports e2e', function(){
  this.timeout(10000);
  let token = null;
  before(async () => {
    // find any verified admin user
    const u = await knex('users').where({ role: 'Admin' }).first();
    if (!u) throw new Error('No Admin user found in DB for tests');
    const payload = { id: u.id, role: 'Admin' };
    token = jwt.sign(payload, process.env.JWT_SECRET || 'replace_this_secret', { expiresIn: '1h' });
  });

  after(async () => { await knex.destroy(); });

  it('GET /api/admin/reports/users returns CSV', async () => {
    const res = await request(app).get('/api/admin/reports/users').set('Authorization', 'Bearer ' + token);
    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.match(/text\/csv/);
    expect(res.text).to.match(/id,name,email/);
  });
});
