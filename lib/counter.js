var redis = require('./redis');

function Counter() {
  this.id = 'rss:counter';
}

Counter.prototype.incr = function* () {
  return yield redis.incr(this.id);
}

Counter.prototype.get = function* () {
  return yield redis.get(this.id);
}

module.exports = new Counter();
