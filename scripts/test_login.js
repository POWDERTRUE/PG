const authController = require('./backend/controllers/authController');
const db = require('./backend/config/db');

async function test() {
  const req = { body: { email: 'migeroro@gmail.com', password: '12345' } };
  const res = {
    status: function(s) {
      console.log('Status:', s);
      return this;
    },
    json: function(j) {
      console.log('JSON:', j);
      return this;
    }
  };
  try {
    await authController.login(req, res);
  } catch (e) {
    console.error('Exception caught:', e);
  }
}

test().then(() => process.exit(0));
