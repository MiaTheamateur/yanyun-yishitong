(function () {
  'use strict';

  var PREFIX = 'YYYS1';
  var CHUNK_SIZE = 1150;
  var STATUS_TO_CODE = { bought: 1, regret: 2, wishlist: 3, abandoned: 4 };
  var CODE_TO_STATUS = { 1: 'bought', 2: 'regret', 3: 'wishlist', 4: 'abandoned' };

  function checksum(value) {
    var hash = 2166136261;
    for (var index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function idToToken(id) {
    var match = /^(paid|free)-(\d+)$/.exec(String(id || ''));
    if (!match) return '';
    return (match[1] === 'paid' ? 'p' : 'f') + Number.parseInt(match[2], 10).toString(36);
  }

  function tokenToId(token) {
    var match = /^([pf])([0-9a-z]+)$/.exec(String(token || ''));
    if (!match) return '';
    var serial = Number.parseInt(match[2], 36);
    if (!Number.isFinite(serial) || serial < 0) return '';
    return (match[1] === 'p' ? 'paid-' : 'free-') + String(serial).padStart(4, '0');
  }

  function bytesToBase64(bytes) {
    var binary = '';
    for (var start = 0; start < bytes.length; start += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(start, start + 8192));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function encodeData(options) {
    var paid = (options.paidRecords || []).map(function (record) {
      var token = idToToken(record.id);
      if (!token) return null;
      return [token, STATUS_TO_CODE[record.status] || 0, record.favorite ? 1 : 0, String(record.review || '').slice(0, 18)];
    }).filter(Boolean);
    var free = (options.freeRecords || []).map(function (record) {
      var token = idToToken(record.id);
      var count = Math.max(0, Math.floor(Number(record.count) || 0));
      return token && count ? [token, count] : null;
    }).filter(Boolean);
    var createdAt = Number(options.createdAt);
    if (!Number.isFinite(createdAt)) createdAt = Date.now();
    var compact = [1, createdAt, paid, free, options.freeGender === 'M' ? 'M' : 'F'];
    return bytesToBase64(new TextEncoder().encode(JSON.stringify(compact)));
  }

  function decodeData(encoded) {
    var compact;
    try {
      compact = JSON.parse(new TextDecoder().decode(base64ToBytes(encoded)));
    } catch (error) {
      throw new Error('备份内容无法识别，请选择清晰的原图');
    }
    if (!Array.isArray(compact) || compact[0] !== 1 || !Array.isArray(compact[2]) || !Array.isArray(compact[3])) {
      throw new Error('备份版本无法识别');
    }
    return {
      schemaVersion: 1,
      createdAt: Number(compact[1]) || 0,
      paidRecords: compact[2].map(function (entry) {
        return {
          id: tokenToId(entry[0]),
          status: CODE_TO_STATUS[Number(entry[1])] || '',
          favorite: Number(entry[2]) === 1,
          review: String(entry[3] || '').slice(0, 18),
        };
      }).filter(function (record) { return Boolean(record.id); }),
      freeRecords: compact[3].map(function (entry) {
        return { id: tokenToId(entry[0]), count: Math.max(0, Math.floor(Number(entry[1]) || 0)) };
      }).filter(function (record) { return Boolean(record.id) && record.count > 0; }),
      freeGender: compact[4] === 'M' ? 'M' : 'F',
    };
  }

  function encode(options) {
    var encoded = encodeData(options || {});
    var digest = checksum(encoded);
    var total = Math.max(1, Math.ceil(encoded.length / CHUNK_SIZE));
    var chunks = [];
    for (var index = 0; index < total; index += 1) {
      chunks.push([PREFIX, index.toString(36), total.toString(36), digest, encoded.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)].join('|'));
    }
    return { chunks: chunks, digest: digest, encodedLength: encoded.length };
  }

  function parseChunk(payload) {
    var parts = String(payload || '').trim().split('|');
    if (parts.length !== 5 || parts[0] !== PREFIX) throw new Error('这不是燕云衣事通生成的备份图');
    var index = Number.parseInt(parts[1], 36);
    var total = Number.parseInt(parts[2], 36);
    if (!Number.isFinite(index) || !Number.isFinite(total) || total < 1 || index < 0 || index >= total) throw new Error('备份分片信息损坏');
    return { index: index, total: total, digest: parts[3], data: parts[4] };
  }

  function decodeChunks(payloads) {
    var parsed = payloads.map(parseChunk);
    var first = parsed[0];
    var byIndex = {};
    parsed.forEach(function (part) {
      if (part.total !== first.total || part.digest !== first.digest) throw new Error('所选备份图内容不完整');
      byIndex[part.index] = part.data;
    });
    var parts = [];
    for (var index = 0; index < first.total; index += 1) {
      if (typeof byIndex[index] !== 'string') throw new Error('备份图有内容未识别，请选择清晰的原图');
      parts.push(byIndex[index]);
    }
    var encoded = parts.join('');
    if (checksum(encoded) !== first.digest) throw new Error('备份图校验失败，请选择未裁剪的原图');
    return decodeData(encoded);
  }

  function fingerprint(options) {
    var clone = Object.assign({}, options || {}, { createdAt: 0 });
    return checksum(encodeData(clone));
  }

  function roundedRect(context, x, y, width, height, radius) {
    var right = x + width;
    var bottom = y + height;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(right - radius, y);
    context.quadraticCurveTo(right, y, right, y + radius);
    context.lineTo(right, bottom - radius);
    context.quadraticCurveTo(right, bottom, right - radius, bottom);
    context.lineTo(x + radius, bottom);
    context.quadraticCurveTo(x, bottom, x, bottom - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function drawQr(context, payload, x, y, availableSize) {
    if (typeof window.qrcode !== 'function') throw new Error('二维码生成组件未加载');
    var qr = window.qrcode(0, 'M');
    qr.addData(payload, 'Byte');
    qr.make();
    var moduleCount = qr.getModuleCount();
    var cellSize = Math.floor(availableSize / moduleCount);
    if (cellSize < 2) throw new Error('单张备份内容过多，请减少短评后重试');
    var qrSize = cellSize * moduleCount;
    var offsetX = x + Math.floor((availableSize - qrSize) / 2);
    var offsetY = y + Math.floor((availableSize - qrSize) / 2);
    context.fillStyle = '#ffffff';
    context.fillRect(x, y, availableSize, availableSize);
    context.fillStyle = '#172943';
    for (var row = 0; row < moduleCount; row += 1) {
      for (var column = 0; column < moduleCount; column += 1) {
        if (qr.isDark(row, column)) context.fillRect(offsetX + column * cellSize, offsetY + row * cellSize, cellSize, cellSize);
      }
    }
  }

  function drawBackupImage(encoded, summary) {
    var chunks = encoded && Array.isArray(encoded.chunks) ? encoded.chunks : [];
    if (!chunks.length) throw new Error('没有可生成的备份内容');
    var multi = chunks.length > 1;
    var rows = multi ? Math.ceil(chunks.length / 2) : 1;
    var canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = multi ? 260 + rows * 390 + 170 : 1180;
    var context = canvas.getContext('2d');
    var gradient = context.createLinearGradient(0, 0, 900, canvas.height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e6edf7');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(255,255,255,.9)';
    roundedRect(context, 42, 40, 816, canvas.height - 80, 34);
    context.fill();
    context.strokeStyle = '#c7d2e0';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = '#24589b';
    context.font = "700 28px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.fillText('燕云衣事通', 86, 105);
    context.fillStyle = '#172943';
    context.font = "800 48px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.fillText('衣柜记录备份', 86, 172);
    context.fillStyle = '#687789';
    context.font = "400 22px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.fillText('服装记录 ' + summary.paidCount + ' 项 · 免费获得 ' + summary.freeCount + ' 项', 86, 216);
    context.textAlign = 'right';
    context.fillText(summary.createdAtLabel, 814, 216);
    context.textAlign = 'left';

    if (!multi) {
      drawQr(context, chunks[0], 126, 270, 648);
    } else {
      chunks.forEach(function (payload, index) {
        var column = index % 2;
        var row = Math.floor(index / 2);
        drawQr(context, payload, 55 + column * 420, 260 + row * 390, 370);
      });
    }

    var footerY = canvas.height - 130;
    context.fillStyle = '#24589b';
    context.font = "700 27px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.textAlign = 'center';
    context.fillText('请保留 PNG 原图，用于跨端恢复记录', 450, footerY);
    context.fillStyle = '#687789';
    context.font = "400 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    context.fillText('恢复时会与当前记录合并，不会清空现有数据', 450, footerY + 42);
    context.fillText(chunks.length > 1 ? '本图含 ' + chunks.length + ' 个数据码，请勿裁剪或压缩' : '打开“记录保护”，选择“恢复记录”并选取此图', 450, footerY + 78);
    context.textAlign = 'left';
    return canvas.toDataURL('image/png');
  }

  function qrFromCanvas(canvas) {
    if (typeof window.jsQR !== 'function') throw new Error('二维码识别组件未加载');
    var context = canvas.getContext('2d');
    var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    var result = window.jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    return result && result.data ? result.data : '';
  }

  function cropAndScan(source, x, y, width, height) {
    var scale = source.width / 900;
    var crop = document.createElement('canvas');
    var sourceWidth = Math.max(1, Math.round(width * scale));
    var sourceHeight = Math.max(1, Math.round(height * scale));
    crop.width = Math.min(900, sourceWidth);
    crop.height = Math.min(900, sourceHeight);
    var context = crop.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(source, Math.round(x * scale), Math.round(y * scale), sourceWidth, sourceHeight, 0, 0, crop.width, crop.height);
    return qrFromCanvas(crop);
  }

  function scanBackupCanvas(canvas) {
    var found = [];
    var full = qrFromCanvas(canvas);
    if (full) {
      var fullPart = parseChunk(full);
      found.push(full);
      if (fullPart.total === 1) return decodeChunks(found);
    }

    var firstPayload = cropAndScan(canvas, 38, 240, 404, 404) || cropAndScan(canvas, 110, 250, 690, 690);
    if (firstPayload) found.push(firstPayload);
    if (!found.length) throw new Error('没有识别到备份二维码，请选择未裁剪的 PNG 原图');
    var firstPart = parseChunk(found[0]);
    if (firstPart.total === 1) return decodeChunks([found[0]]);

    var unique = {};
    found.forEach(function (payload) { var part = parseChunk(payload); unique[part.index] = payload; });
    for (var index = 0; index < firstPart.total; index += 1) {
      if (unique[index]) continue;
      var column = index % 2;
      var row = Math.floor(index / 2);
      var payload = cropAndScan(canvas, 38 + column * 420, 243 + row * 390, 404, 404);
      if (payload) {
        var part = parseChunk(payload);
        unique[part.index] = payload;
      }
    }
    return decodeChunks(Object.keys(unique).map(function (key) { return unique[key]; }));
  }

  function decodeImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//i.test(file.type || '')) { reject(new Error('请选择备份图片')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('无法读取所选图片')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('所选图片无法识别')); };
        image.onload = function () {
          try {
            var scale = image.naturalWidth > 1800 ? 1800 / image.naturalWidth : 1;
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(scanBackupCanvas(canvas));
          } catch (error) { reject(error); }
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.YANYUN_BACKUP = {
    encode: encode,
    decodeChunks: decodeChunks,
    drawBackupImage: drawBackupImage,
    decodeImageFile: decodeImageFile,
    fingerprint: fingerprint,
  };
}());
