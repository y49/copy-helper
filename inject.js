// Web-Limits-Remover - 精简修正版
(function() {
  'use strict';
  
  // 黑名单
  var black_list = [
    /.*\.youtube\.com.*/,
    /.*\.wikipedia\.org.*/,
    /mail\.qq\.com.*/,
    /translate\.google\..*/
  ];
  var url = window.location.host + window.location.pathname;
  if (black_list.some(re => re.test(url))) return;

  // 只 hook 这些事件
  var hookEvents = ["contextmenu", "select", "selectstart", "copy", "cut", "dragstart"];
  var EventTarget_addEventListener = EventTarget.prototype.addEventListener;
  var document_addEventListener = document.addEventListener;
  var window_addEventListener = window.addEventListener;
  var Event_preventDefault = Event.prototype.preventDefault;

  function returnTrue() { return true; }
  function addEventListener(type, func, useCapture) {
    var _add = this === document ? document_addEventListener :
               this === window ? window_addEventListener :
               EventTarget_addEventListener;
    if (hookEvents.indexOf(type) >= 0) {
      _add.apply(this, [type, returnTrue, useCapture]);
    } else {
      _add.apply(this, arguments);
    }
  }

  // hook所有 addEventListener
  EventTarget.prototype.addEventListener = addEventListener;
  document.addEventListener = addEventListener;
  window.addEventListener = addEventListener;

  // 清理 DOM0
  function clearLoop() {
    var elements = Array.prototype.slice.call(document.getElementsByTagName('*'));
    elements.push(document);
    for (var i = 0; i < elements.length; i++) {
      for (var j = 0; j < hookEvents.length; j++) {
        var name = 'on' + hookEvents[j];
        if (elements[i][name]) elements[i][name] = null;
      }
    }
  }

  // MutationObserver 实时清理新节点
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            for (var j = 0; j < hookEvents.length; j++) {
              var name = 'on' + hookEvents[j];
              if (node[name]) node[name] = null;
            }
            // 递归清理子节点
            var descendants = node.getElementsByTagName ? node.getElementsByTagName('*') : [];
            for (var k = 0; k < descendants.length; k++) {
              for (var j = 0; j < hookEvents.length; j++) {
                var name = 'on' + hookEvents[j];
                if (descendants[k][name]) descendants[k][name] = null;
              }
            }
          }
        });
      }
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(clearLoop, 30 * 1000);
  setTimeout(clearLoop, 2500);
  window.addEventListener('load', clearLoop, true);
  clearLoop();

  Event.prototype.preventDefault = function() {
    if (hookEvents.indexOf(this.type) < 0) {
      Event_preventDefault.apply(this, arguments);
    }
  };

  Event.prototype.__defineSetter__('returnValue', function() {
    if (this.returnValue !== true && hookEvents.indexOf(this.type) >= 0) {
      this.returnValue = true;
    }
  });

  // 样式
  function addStyle(css) {
    var style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
  }
  addStyle('html, * {-webkit-user-select:text!important; -moz-user-select:text!important; user-select:text!important; -ms-user-select:text!important; -khtml-user-select:text!important;}');
})();