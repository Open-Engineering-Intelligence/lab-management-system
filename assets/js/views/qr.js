/* 扫码进站页：展示可直接被手机相机 / 微信扫一扫识别的进站二维码 */
(function (L) {
  'use strict';
  L.views = L.views || {};

  /* 进站地址：只保留分享码 sharecode 和进站意图 checkin=1，去掉 hash 路由、autologin 和
     一切调试/统计参数。关键：内容必须是普通网址，不能是微信登录链接，否则微信只允许
     “扫一扫”摄像头识别、长按会被拒绝。普通网址二维码在微信里长按图片即可直接识别打开。
     checkin=1 让扫码打开后直达轻量进站登记页（填姓名学号→匹配花名册→写入进站记录）。 */
  function entryUrl() {
    var KEEP = ['sharecode'];
    try {
      var u = new URL(location.href);
      u.hash = '';
      Array.prototype.slice.call(Array.from(u.searchParams.keys())).forEach(function (k) {
        if (KEEP.indexOf(k) < 0) u.searchParams.delete(k);
      });
      u.searchParams.set('checkin', '1');
      return u.toString();
    } catch (e) {
      return location.href.split('#')[0].split('?')[0] + '?checkin=1';
    }
  }

  L.views['qr'] = {
    title: '扫码进站',
    render: function () {
      var url = entryUrl();
      var svg = (L.qr && L.qr.poster) ? L.qr.poster(url, 320) : '';
      return '<div class="page-head"><div><h1>扫码进站</h1><p>把这张二维码发给他人，微信里长按图片识别即可直达进站登记：填姓名学号、匹配花名册、自动记录进站。</p></div></div>' +
        '<section class="card card-pad qr-page">' +
          '<div class="qr-page-grid">' +
            '<div class="qr-paper">' + (svg || '<div class="small muted">二维码组件未加载</div>') + '</div>' +
            '<div class="qr-side">' +
              '<h3>使用说明</h3>' +
              '<ol class="qr-steps">' +
                '<li>把左侧二维码图片发给对方（或保存后发到微信）</li>' +
                '<li>在微信里长按图片 →「识别图中二维码」，直达进站登记页</li>' +
                '<li>填真实姓名与学号，匹配花名册后自动保存进站记录</li>' +
                '<li>手机相机扫一扫同样可打开；微信绑定为可选，不强制</li>' +
              '</ol>' +
              '<div class="small faint" style="margin:-6px 0 16px">进站登记无需登录。需要微信绑定时，到「微信登录与绑定」手动发起即可。</div>' +
              '<div class="qr-url"><div class="small muted">二维码内容（进站网址）</div><code class="code">' + L.ui.esc(url) + '</code></div>' +
              '<div class="row" style="gap:10px;margin-top:16px;flex-wrap:wrap">' +
                '<button class="btn primary" id="qrDownload">下载二维码 PNG</button>' +
                '<button class="btn" id="qrCopy">复制进站网址</button>' +
              '</div>' +
              '<div class="small faint" style="margin-top:12px;line-height:1.6">二维码已按手机识别优化：Q 级纠错（25% 容错）、纯黑白高对比、标准静默留白、边缘锐利不抗锯齿。</div>' +
            '</div>' +
          '</div>' +
        '</section>';
    },
    mount: function (root) {
      var url = entryUrl();
      var dl = root.querySelector('#qrDownload');
      if (dl) dl.onclick = function () {
        var svgEl = root.querySelector('.qr-paper svg');
        if (!svgEl || !L.qr) return L.ui.toast('二维码组件未加载', true);
        var clone = svgEl.cloneNode(true);
        clone.setAttribute('width', '784');
        clone.setAttribute('height', '784');
        var data = new XMLSerializer().serializeToString(clone);
        var blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
        var objUrl = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = canvas.height = 784;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 784, 784);
          ctx.drawImage(img, 0, 0, 784, 784);
          URL.revokeObjectURL(objUrl);
          try {
            var a = document.createElement('a');
            a.download = '进站二维码.png';
            a.href = canvas.toDataURL('image/png');
            document.body.appendChild(a); a.click(); a.remove();
            L.ui.toast('二维码已下载');
          } catch (e) { L.ui.toast('下载失败，请右键二维码另存', true); }
        };
        img.onerror = function () { URL.revokeObjectURL(objUrl); L.ui.toast('生成图片失败', true); };
        img.src = objUrl;
      };
      var cp = root.querySelector('#qrCopy');
      if (cp) cp.onclick = function () {
        var done = function () { L.ui.toast('进站网址已复制'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { L.ui.toast('复制失败，请手动选择', true); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = url; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) { L.ui.toast('复制失败，请手动选择', true); }
          ta.remove();
        }
      };
    }
  };
})(window.LabApp = window.LabApp || {});
