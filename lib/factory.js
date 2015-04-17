function factory() {

}

factory.create = function(source, id) {
	var Handler = require('./rss/' + source + '.js');
	return new Handler(id);
}

module.exports = factory;