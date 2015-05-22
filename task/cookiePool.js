var cookiePool = require('../lib/cookiePool');
var co = require('co');
co(function*() {
  var cookies = yield cookiePool.collectAll();
  if (cookies.toString().indexOf('SNUID=') != -1) {
    yield cookiePool.destroy();
    yield cookiePool.save(cookies);
    console.log(cookies.join(' '));  
    console.log('update cookies success'); 
  } else {
    console.log('update cookies error');
  }
});