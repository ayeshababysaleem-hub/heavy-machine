const { expect } = require('chai');
const { toMySQLDate, objectArrayToCSV } = require('../../server');

describe('helpers', () => {
  it('toMySQLDate formats Date and ISO strings', () => {
    const d = new Date('2026-05-12T10:11:12Z');
    const out = toMySQLDate(d);
    expect(out).to.be.a('string');
    expect(out).to.match(/^2026-05-12/);
  });

  it('objectArrayToCSV converts objects to CSV with header', () => {
    const arr = [{ a: 1, b: 'x' }, { a: 2, b: 'y' }];
    const csv = objectArrayToCSV(arr, ['a','b']);
    expect(csv).to.contain('a,b');
    expect(csv.split('\n').length).to.equal(3);
  });
});
