(function () {
  'use strict';

  var PREFIX = 'YYYS1';
  var COMPACT_PREFIX = 'YYYS2';
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
    if (Array.isArray(options.swordChoices) && options.swordChoices.some(Boolean)) {
      compact.push(options.swordChoices.slice(0, 4).map(function (id) { return id ? idToToken(id) || 0 : 0; }));
    }
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
      swordChoices: Array.isArray(compact[5]) && compact[5].length === 4
        ? compact[5].map(function (token) { return token ? tokenToId(token) || '' : ''; }) : undefined,
    };
  }

  function writeNumber(bytes, value) {
    value = Math.floor(Number(value) || 0);
    do {
      var digit = value % 128;
      value = Math.floor(value / 128);
      bytes.push(digit | (value ? 128 : 0));
    } while (value);
  }

  function readNumber(bytes, cursor) {
    var value = 0;
    var scale = 1;
    for (var count = 0; count < 8; count += 1) {
      if (cursor.index >= bytes.length) throw new Error('备份内容不完整');
      var digit = bytes[cursor.index++];
      value += (digit & 127) * scale;
      if (!(digit & 128)) return value;
      scale *= 128;
    }
    throw new Error('备份数字无法识别');
  }

  function serialOf(id, kind) {
    var match = new RegExp('^' + kind + '-(\\d+)$').exec(String(id || ''));
    return match ? Number(match[1]) : -1;
  }

  function encodeCompactData(options) {
    var paid = options.paidRecords || [];
    var free = options.freeRecords || [];
    var paidMax = 0;
    var freeMax = 0;
    var reviews = [];
    paid.forEach(function (record) {
      var serial = serialOf(record.id, 'paid');
      if (serial < 1 || serial > 4096) throw new Error('无法压缩服装编号');
      paidMax = Math.max(paidMax, serial);
    });
    free.forEach(function (record) {
      var serial = serialOf(record.id, 'free');
      if (serial < 1 || serial > 4096 || Number(record.count) > 254) throw new Error('无法压缩免费记录');
      freeMax = Math.max(freeMax, serial);
    });
    var paidBytes = new Uint8Array(paidMax);
    var freeBytes = new Uint8Array(freeMax);
    paid.forEach(function (record) {
      var serial = serialOf(record.id, 'paid');
      paidBytes[serial - 1] = (STATUS_TO_CODE[record.status] || 0) | (record.favorite ? 8 : 0);
      var review = String(record.review || '').slice(0, 18);
      if (review) reviews.push([serial, review]);
    });
    free.forEach(function (record) {
      freeBytes[serialOf(record.id, 'free') - 1] = Math.max(0, Math.floor(Number(record.count) || 0));
    });
    var bytes = [2];
    writeNumber(bytes, Number(options.createdAt) || Date.now());
    bytes.push(options.freeGender === 'M' ? 1 : 0);
    writeNumber(bytes, paidMax);
    writeNumber(bytes, freeMax);
    for (var index = 0; index < paidBytes.length; index += 2) bytes.push(paidBytes[index] | ((paidBytes[index + 1] || 0) << 4));
    for (var freeIndex = 0; freeIndex < freeBytes.length; freeIndex += 1) bytes.push(freeBytes[freeIndex]);
    writeNumber(bytes, reviews.length);
    reviews.forEach(function (entry) {
      var textBytes = new TextEncoder().encode(entry[1]);
      writeNumber(bytes, entry[0]);
      writeNumber(bytes, textBytes.length);
      for (var i = 0; i < textBytes.length; i += 1) bytes.push(textBytes[i]);
    });
    var choices = Array.isArray(options.swordChoices) ? options.swordChoices : [];
    for (var choice = 0; choice < 4; choice += 1) {
      var selected = choices[choice] ? serialOf(choices[choice], 'free') : 0;
      if (selected < 0) throw new Error('无法压缩藏锋记录');
      writeNumber(bytes, selected);
    }
    return bytesToBase64(new Uint8Array(bytes));
  }

  function decodeCompactData(encoded) {
    var bytes = base64ToBytes(encoded);
    var cursor = { index: 0 };
    if (bytes[cursor.index++] !== 2) throw new Error('备份版本无法识别');
    var createdAt = readNumber(bytes, cursor);
    var gender = bytes[cursor.index++] === 1 ? 'M' : 'F';
    var paidMax = readNumber(bytes, cursor);
    var freeMax = readNumber(bytes, cursor);
    if (paidMax > 4096 || freeMax > 4096 || cursor.index + Math.ceil(paidMax / 2) + freeMax > bytes.length) throw new Error('备份内容不完整');
    var paidRecords = [];
    for (var paidIndex = 1; paidIndex <= paidMax; paidIndex += 1) {
      var packed = bytes[cursor.index + Math.floor((paidIndex - 1) / 2)];
      var value = paidIndex % 2 ? packed & 15 : packed >> 4;
      if (value) paidRecords.push({ id: 'paid-' + String(paidIndex).padStart(4, '0'), status: CODE_TO_STATUS[value & 7] || '', favorite: Boolean(value & 8), review: '' });
    }
    cursor.index += Math.ceil(paidMax / 2);
    var freeRecords = [];
    for (var freeIndex = 1; freeIndex <= freeMax; freeIndex += 1) {
      var count = bytes[cursor.index++];
      if (count) freeRecords.push({ id: 'free-' + String(freeIndex).padStart(4, '0'), count: count });
    }
    var reviewCount = readNumber(bytes, cursor);
    if (reviewCount > paidMax) throw new Error('备份短评数量异常');
    var paidById = {};
    paidRecords.forEach(function (record) { paidById[record.id] = record; });
    for (var reviewIndex = 0; reviewIndex < reviewCount; reviewIndex += 1) {
      var serial = readNumber(bytes, cursor);
      var length = readNumber(bytes, cursor);
      if (length > 72 || cursor.index + length > bytes.length) throw new Error('备份短评不完整');
      var id = 'paid-' + String(serial).padStart(4, '0');
      var review = new TextDecoder().decode(bytes.subarray(cursor.index, cursor.index + length)).slice(0, 18);
      cursor.index += length;
      if (paidById[id]) paidById[id].review = review;
      else if (serial >= 1 && serial <= paidMax) {
        var record = { id: id, status: '', favorite: false, review: review };
        paidRecords.push(record);
        paidById[id] = record;
      }
    }
    var swordChoices = [];
    for (var choice = 0; choice < 4; choice += 1) {
      var selected = readNumber(bytes, cursor);
      swordChoices.push(selected ? 'free-' + String(selected).padStart(4, '0') : '');
    }
    if (cursor.index !== bytes.length) throw new Error('备份内容存在多余数据');
    return { schemaVersion: 2, createdAt: createdAt, paidRecords: paidRecords, freeRecords: freeRecords, freeGender: gender, swordChoices: swordChoices };
  }

  function encode(options) {
    var compact = '';
    try {
      compact = encodeCompactData(options || {});
      var singlePayload = [COMPACT_PREFIX, checksum(compact), compact].join('|');
      if (typeof window.qrcode === 'function') {
        var singleQr = window.qrcode(0, 'M');
        singleQr.addData(singlePayload, 'Byte');
        singleQr.make();
        return { chunks: [singlePayload], digest: checksum(compact), encodedLength: compact.length, format: 2 };
      }
    } catch (error) { /* A single QR has a fixed capacity. */ }
    if (compact && typeof window.qrcode === 'function') {
      var compactDigest = checksum(compact);
      var compactSize = 1400;
      var compactTotal = Math.ceil(compact.length / compactSize);
      var compactChunks = [];
      for (var part = 0; part < compactTotal; part += 1) {
        compactChunks.push([COMPACT_PREFIX, part.toString(36), compactTotal.toString(36), compactDigest, compact.slice(part * compactSize, (part + 1) * compactSize)].join('|'));
      }
      return { chunks: compactChunks, digest: compactDigest, encodedLength: compact.length, format: 2 };
    }
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
    if (parts.length === 3 && parts[0] === COMPACT_PREFIX) return { index: 0, total: 1, digest: parts[1], data: parts[2], format: 2 };
    if (parts.length !== 5 || (parts[0] !== PREFIX && parts[0] !== COMPACT_PREFIX)) throw new Error('这不是燕云衣事通生成的备份图');
    var index = Number.parseInt(parts[1], 36);
    var total = Number.parseInt(parts[2], 36);
    if (!Number.isFinite(index) || !Number.isFinite(total) || total < 1 || index < 0 || index >= total) throw new Error('备份分片信息损坏');
    return { index: index, total: total, digest: parts[3], data: parts[4], format: parts[0] === COMPACT_PREFIX ? 2 : 1 };
  }

  function decodeChunks(payloads) {
    if (payloads.length === 1 && String(payloads[0]).indexOf(COMPACT_PREFIX + '|') === 0) {
      var compactParts = String(payloads[0]).trim().split('|');
      if (compactParts.length !== 3 || checksum(compactParts[2]) !== compactParts[1]) throw new Error('备份图校验失败，请选择未裁剪的原图');
      return decodeCompactData(compactParts[2]);
    }
    var parsed = payloads.map(parseChunk);
    var first = parsed[0];
    var byIndex = {};
    parsed.forEach(function (part) {
      if (part.total !== first.total || part.digest !== first.digest || part.format !== first.format) throw new Error('所选备份图内容不完整');
      byIndex[part.index] = part.data;
    });
    var parts = [];
    for (var index = 0; index < first.total; index += 1) {
      if (typeof byIndex[index] !== 'string') throw new Error('备份图有内容未识别，请选择清晰的原图');
      parts.push(byIndex[index]);
    }
    var encoded = parts.join('');
    if (checksum(encoded) !== first.digest) throw new Error('备份图校验失败，请选择未裁剪的原图');
    return first.format === 2 ? decodeCompactData(encoded) : decodeData(encoded);
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
