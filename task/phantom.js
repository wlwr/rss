var phantom = require('phantom');

var startTime = new Date().getTime();
phantom.create(function (ph) {
  ph.createPage(function (page) {
    page.set('onResourceRequested', function(requestData, request) {
      if ((/http:\/\/.+?\.css/gi).test(requestData['url']) || requestData['Content-Type'] == 'text/css') {
        console.log('The url of the request is matching. Aborting: ' + requestData['url']);
        request['abort()'];
      }
    });
    page.open("http://weixin.sogou.com/weixin?query=123", function (status) {
      page.evaluate(function () { return document.cookie; }, function (result) {
        console.log(result);
      });
    });
  });
}, {parameters: {'load-images': 'no'}});