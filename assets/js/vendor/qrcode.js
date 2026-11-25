/* 纯前端二维码生成器（零依赖，离线可用）
   支持字节模式、纠错级别 L/M/Q/H、版本 1-40 自动选择。
   基于 QR 规范实现：GF(256) Reed-Solomon、功能图形、8 种掩码择优选。 */
(function (L) {
  'use strict';

  var MIN_VERSION = 1, MAX_VERSION = 40;
  var PENALTY_N1 = 3, PENALTY_N2 = 3, PENALTY_N3 = 40, PENALTY_N4 = 10;

  var ECC_PER_BLOCK = {
    L: [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    M: [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    Q: [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    H: [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  };
  var NUM_BLOCKS = {
    L: [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    M: [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    Q: [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    H: [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  };
  var FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* GF(256) 对数表（生成多项式 0x11D） */
  var EXP = new Array(512), LOG = new Array(256), i, x = 1;
  for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  function gfMul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }
  function gfDiv(a, b) { if (a === 0) return 0; return EXP[(LOG[a] - LOG[b] + 255) % 255]; }

  function reedSolomonDivisor(degree) {
    var result = [], i, j;
    for (i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 2);
    }
    return result;
  }
  function reedSolomonRemainder(data, divisor) {
    var result = [], i, j, factor;
    for (i = 0; i < divisor.length; i++) result.push(0);
    for (i = 0; i < data.length; i++) {
      factor = data[i] ^ result[0];
      result.shift(); result.push(0);
      for (j = 0; j < divisor.length; j++) result[j] ^= gfMul(divisor[j], factor);
    }
    return result;
  }

  function numRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }
  function numDataCodewords(ver, ecl) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
  }
  function alignmentPositions(ver) {
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var size = ver * 4 + 17;
    var step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    var result = [6], pos = size - 7;
    while (result.length < numAlign) { result.splice(1, 0, pos); pos -= step; }
    return result;
  }

  function utf8Bytes(text) {
    var s = unescape(encodeURIComponent(String(text))), out = [], i;
    for (i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xFF);
    return out;
  }

  function appendBits(val, len, out) {
    for (var i = len - 1; i >= 0; i--) out.push((val >>> i) & 1);
  }

  function createDataCodewords(text, ver, ecl) {
    var bits = [], data = utf8Bytes(text), cap = numDataCodewords(ver, ecl);
    appendBits(4, 4, bits); // 字节模式
    appendBits(data.length, ver <= 9 ? 8 : 16, bits);
    data.forEach(function (b) { appendBits(b, 8, bits); });
    var capBits = cap * 8;
    appendBits(0, Math.min(4, capBits - bits.length), bits); // 终止符
    while (bits.length % 8 !== 0) bits.push(0); // 对齐字节
    var pad = 0xEC;
    while (bits.length < capBits) { appendBits(pad, 8, bits); pad ^= 0xEC ^ 0x11; }
    var out = [], i;
    for (i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      out.push(v);
    }
    return out;
  }

  function addEccAndInterleave(data, ver, ecl) {
    var blockEccLen = ECC_PER_BLOCK[ecl][ver], numBlocks = NUM_BLOCKS[ecl][ver];
    var rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);
    var blocks = [], i;
    var divisor = reedSolomonDivisor(blockEccLen);
    var k = 0;
    for (i = 0; i < numBlocks; i++) {
      var datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      var dat = data.slice(k, k + datLen); k += datLen;
      blocks.push({ data: dat, ecc: reedSolomonRemainder(dat, divisor) });
    }
    var result = [];
    for (i = 0; i < shortBlockLen - blockEccLen + 1; i++) {
      for (var b = 0; b < numBlocks; b++) {
        if (i !== shortBlockLen - blockEccLen || b >= numShortBlocks) result.push(blocks[b].data[i]);
      }
    }
    for (i = 0; i < blockEccLen; i++) {
      for (var b2 = 0; b2 < numBlocks; b2++) result.push(blocks[b2].ecc[i]);
    }
    return result;
  }

  function QrMatrix(ver, ecl) {
    this.version = ver;
    this.size = ver * 4 + 17;
    this.ecl = ecl;
    this.modules = [];
    this.isFunction = [];
    var i, j;
    for (i = 0; i < this.size; i++) {
      this.modules.push(new Array(this.size).fill(false));
      this.isFunction.push(new Array(this.size).fill(false));
    }
  }
  QrMatrix.prototype.setFunction = function (x, y, dark) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return;
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  };
  QrMatrix.prototype.drawFunctionPatterns = function () {
    var i, j, sz = this.size;
    // 定时图形
    for (i = 0; i < sz; i++) { this.setFunction(6, i, i % 2 === 0); this.setFunction(i, 6, i % 2 === 0); }
    // 定位图形 + 分隔符
    this.drawFinder(3, 3); this.drawFinder(sz - 4, 3); this.drawFinder(3, sz - 4);
    // 对齐图形
    var pos = alignmentPositions(this.version);
    for (i = 0; i < pos.length; i++) for (j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      this.drawAlignment(pos[i], pos[j]);
    }
    // 格式信息占位（全 0），版本信息占位
    this.drawFormatBits(0);
    if (this.version >= 7) this.drawVersionBits();
  };
  QrMatrix.prototype.drawFinder = function (cx, cy) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy));
      this.setFunction(cx + dx, cy + dy, dist !== 2 && dist !== 4);
    }
  };
  QrMatrix.prototype.drawAlignment = function (cx, cy) {
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
      this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  };
  QrMatrix.prototype.drawFormatBits = function (mask) {
    var data = (FORMAT_BITS[this.ecl] << 3) | mask, rem = data, i;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    var sz = this.size;
    for (i = 0; i <= 5; i++) this.setFunction(8, i, getBit(bits, i));
    this.setFunction(8, 7, getBit(bits, 6));
    this.setFunction(8, 8, getBit(bits, 7));
    this.setFunction(7, 8, getBit(bits, 8));
    for (i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i));
    for (i = 0; i < 8; i++) this.setFunction(sz - 1 - i, 8, getBit(bits, i));
    for (i = 8; i < 15; i++) this.setFunction(8, sz - 15 + i, getBit(bits, i));
    this.setFunction(8, sz - 8, true); // 固定黑模块
  };
  QrMatrix.prototype.drawVersionBits = function () {
    var ver = this.version, rem = ver, i;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (ver << 12) | rem, sz = this.size;
    for (i = 0; i < 18; i++) {
      var bit = getBit(bits, i), a = sz - 11 + i % 3, b = Math.floor(i / 3);
      this.setFunction(a, b, bit); this.setFunction(b, a, bit);
    }
  };
  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function maskFn(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
    return false;
  }

  QrMatrix.prototype.drawCodewords = function (codewords) {
    var i = 0, sz = this.size, x, y, upward, j;
    for (var right = sz - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < sz; vert++) {
        for (j = 0; j < 2; j++) {
          x = right - j;
          upward = ((right + 1) & 2) === 0;
          y = upward ? sz - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  };
  QrMatrix.prototype.applyMask = function (mask) {
    var sz = this.size;
    for (var y = 0; y < sz; y++) for (var x = 0; x < sz; x++)
      if (!this.isFunction[y][x] && maskFn(mask, x, y)) this.modules[y][x] = !this.modules[y][x];
  };
  QrMatrix.prototype.penalty = function () {
    var sz = this.size, m = this.modules, p = 0, i, j, runColor, runLen;
    // N1: 连续同色
    function penaltyN() {
      var result = 0;
      for (var yy = 0; yy < sz; yy++) {
        runColor = false; runLen = 0;
        for (var xx = 0; xx < sz; xx++) {
          if (m[yy][xx] === runColor) { runLen++; if (runLen === 5) result += PENALTY_N1; else if (runLen > 5) result++; }
          else { runColor = m[yy][xx]; runLen = 1; }
        }
      }
      for (var xx2 = 0; xx2 < sz; xx2++) {
        runColor = false; runLen = 0;
        for (var yy2 = 0; yy2 < sz; yy2++) {
          if (m[yy2][xx2] === runColor) { runLen++; if (runLen === 5) result += PENALTY_N1; else if (runLen > 5) result++; }
          else { runColor = m[yy2][xx2]; runLen = 1; }
        }
      }
      return result;
    }
    p += penaltyN();
    // N2: 2x2 同色块
    for (i = 0; i < sz - 1; i++) for (j = 0; j < sz - 1; j++) {
      var c = m[i][j];
      if (m[i][j + 1] === c && m[i + 1][j] === c && m[i + 1][j + 1] === c) p += PENALTY_N2;
    }
    // N3: 1:1:3:1:1 图案带浅色区
    for (i = 0; i < sz; i++) {
      for (j = 0; j < sz - 10; j++) {
        if (m[i][j] && !m[i][j+1] && m[i][j+2] && m[i][j+3] && m[i][j+4] && !m[i][j+5] && m[i][j+6] && !m[i][j+7] && !m[i][j+8] && !m[i][j+9] && !m[i][j+10]) p += PENALTY_N3;
        if (m[j][i] && !m[j+1][i] && m[j+2][i] && m[j+3][i] && m[j+4][i] && !m[j+5][i] && m[j+6][i] && !m[j+7][i] && !m[j+8][i] && !m[j+9][i] && !m[j+10][i]) p += PENALTY_N3;
      }
    }
    // N4: 黑白比例
    var dark = 0;
    for (i = 0; i < sz; i++) for (j = 0; j < sz; j++) if (m[i][j]) dark++;
    var total = sz * sz;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    p += k * PENALTY_N4;
    return p;
  };

  function encode(text, ecl) {
    ecl = ECC_PER_BLOCK[ecl] ? ecl : 'Q';
    text = String(text == null ? '' : text);
    var bytes = utf8Bytes(text), ver, min = MIN_VERSION;
    for (ver = MIN_VERSION; ver <= MAX_VERSION; ver++) {
      if (bytes.length + 2 <= Math.floor(numRawDataModules(ver) / 8)) {
        var needed = bytes.length + (ver <= 9 ? 2 : 3); // 模式+计数(字节单位近似)
        if (bytes.length <= numDataCodewords(ver, ecl) - (ver <= 9 ? 2 : 3)) { min = ver; break; }
      }
    }
    if (ver > MAX_VERSION) throw new Error('内容过长，无法生成二维码');
    var data = createDataCodewords(text, min, ecl);
    var all = addEccAndInterleave(data, min, ecl);
    var qr = new QrMatrix(min, ecl);
    qr.drawFunctionPatterns();
    qr.drawCodewords(all);
    var bestMask = 0, bestPenalty = Infinity, mask, pen;
    for (mask = 0; mask < 8; mask++) {
      qr.applyMask(mask);
      qr.drawFormatBits(mask);
      pen = qr.penalty();
      if (pen < bestPenalty) { bestPenalty = pen; bestMask = mask; }
      qr.applyMask(mask); // 撤销，恢复未掩码状态
    }
    qr.applyMask(bestMask);
    qr.drawFormatBits(bestMask);
    return qr;
  }

  var QR = {
    encode: encode,
    /* 生成 SVG 字符串。
       默认参数针对手机相机/微信扫一扫做了可识别性优化：
       - ecl=Q：25% 码字容错，兼顾鲁棒性与模块密度
       - quiet=4：满足规范的最低静默区，实测建议留白充足
       - 纯黑 #000 / 纯白 #fff：最大对比度
       - shape-rendering=crispEdges：关闭抗锯齿，边缘锐利不糊
       - 整数模块坐标，避免缩放后边缘发虚 */
    svg: function (text, size, opts) {
      opts = opts || {};
      var qr = encode(text, opts.ecl || 'Q');
      var n = qr.size, quiet = opts.quiet == null ? 4 : opts.quiet;
      var total = n + quiet * 2;
      var fg = opts.fg || '#000000', bg = opts.bg || '#ffffff';
      size = size || 256;
      var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
        '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" ' +
        'style="image-rendering:pixelated;display:block">';
      s += '<rect width="' + total + '" height="' + total + '" fill="' + bg + '"/>';
      s += '<path fill="' + fg + '" d="';
      var parts = [];
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        if (qr.modules[y][x]) parts.push('M' + (x + quiet) + ' ' + (y + quiet) + 'h1v1h-1z');
      }
      s += parts.join('') + '"/></svg>';
      return s;
    },
    /* 海报级进站二维码：打包最优识别参数，一条调用即可得到可打印/可扫码的 SVG。
       比默认更保守的取舍：Q 纠错 + 4 模块静默区 + 纯黑白 + 大尺寸。 */
    poster: function (text, size) {
      return QR.svg(text, size || 260, { ecl: 'Q', quiet: 4, fg: '#000000', bg: '#ffffff' });
    },
    /* 供测试：返回矩阵 */
    matrix: function (text, ecl) { return encode(text, ecl || 'Q').modules; }
  };

  L.qr = QR;
})(window.LabApp = window.LabApp || {});
