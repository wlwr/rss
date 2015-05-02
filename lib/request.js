var config = require('../config/global');
var _request = require('request');


function request(uri, options) {
	return function(callback) {
    if (options && options.proxyEnable) {
      _request = _request.defaults({proxy: config.proxy});
    }
		_request(uri, options, function(error, response, body) {
			callback(error, response);
		})
	}
}

module.exports = request;