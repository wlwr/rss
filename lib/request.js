var _request = require('request');

function request(uri, options) {
	return function(callback) {
		_request(uri, options, function(error, response, body) {
			callback(error, response);
		})
	}
}

module.exports = request;