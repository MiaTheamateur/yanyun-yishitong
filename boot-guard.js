(function () {
  'use strict';

  var completed = false;
  var timer = window.setTimeout(function () {
    if (completed) return;
    var boot = document.getElementById('appBoot');
    var message = boot && boot.querySelector('p');
    if (message) message.textContent = '加载时间较长，请稍候或重新打开小工具';
  }, 8000);

  window.__OUTFIT_BOOT_GUARD__ = {
    complete: function () {
      completed = true;
      window.clearTimeout(timer);
    }
  };
}());
