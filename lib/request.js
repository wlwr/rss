var config = require('../config/global');
var _request = require('request');

if (config.proxyEnable) {
  _request = _request.defaults({proxy: config.proxy});
}

function request(uri, options) {
	return function(callback) {
		_request(uri, options, function(error, response, body) {
			callback(error, response);
		})
	}
}

module.exports = request;