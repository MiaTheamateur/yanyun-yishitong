(function () {
  'use strict';

  var appShell = document.querySelector('.app-shell');
  var isXhsContainer = Boolean(window.xhs && window.xhs.miniTool);
  if (appShell) appShell.classList.toggle('is-xhs-container', isXhsContainer);

  var STORAGE_KEY = 'yanyun-outfit-book-state-v3';
  var STATUS = { bought: '已入手', notBought: '放弃 / 忍住', regret: '后悔买', missed: '求返场' };
  var REVIEW_RED = '#9b3f45';
  var FREE_CATALOG_TYPE_ORDER = ['套装', '发型', '衣服', '首饰', '配饰', '帽子', '披挂', '武器'];
  var FREE_CATALOG_TYPE_LABELS = { '衣服': '服装' };
  var FREE_CLASSIFICATION_ALIASES = { '逐战商店': '常驻玩法', '2026/12/25': '野外首领' };
  var FREE_CLASSIFICATION_GROUPS = [
    { label: '不错小店', tags: ['不错小店'], children: [] },
    { label: '不肝商店', tags: ['不肝商店'], children: [] },
    { label: '社交商店', tags: ['社交商店'], children: [] },
    { label: '剧情探索成就', tags: ['成就奖励', '探索玩法', '剧情任务', '野外首领'], children: ['成就奖励', '探索玩法', '剧情任务', '野外首领'] },
    { label: '和鸣', tags: ['和鸣累抽奖励', '和鸣池内奖励', '天精地华商店'], children: ['和鸣累抽奖励', '和鸣池内奖励', '天精地华商店'] },
    { label: '玉池', tags: ['常驻玉池', '限定玉池'], children: ['常驻玉池', '限定玉池'] },
    { label: '战斗', tags: ['PVE战斗', 'PVP战斗'], children: ['PVE战斗', 'PVP战斗'] },
    { label: '常驻玩法', tags: ['常驻玩法', '门派玩法', '悬赏商店', '家业玩法'], children: ['门派玩法', '悬赏商店', '家业玩法'] },
    { label: '活动', tags: ['限时活动', '其他活动'], children: ['限时活动', '其他活动'] }
  ];
  var data = Array.isArray(window.OUTFIT_DATA) ? window.OUTFIT_DATA : [];
  var paidItems = data.filter(function (item) { return item.acquisitionType === '付费'; });
  var paidListItems = paidItems.filter(function (item) { return item.listingStatus !== '预告'; });
  var freeItems = data.filter(function (item) { return item.acquisitionType === '免费'; });
  var freeSets = freeItems.filter(function (item) { return item.recordShape === '套装'; });
  var freeCollectibles = freeItems.filter(function (item) { return item.recordShape !== '套装'; });
  var freeSetById = {};
  var freeItemById = {};
  freeSets.forEach(function (item) { freeSetById[item.id] = item; });
  freeItems.forEach(function (item) { freeItemById[item.id] = item; });
  var FREE_EXCLUSIVE_GROUP_NAMES = [['藏锋·剑', '藏锋·枪']];
  var freeExclusiveGroupById = {};
  FREE_EXCLUSIVE_GROUP_NAMES.forEach(function (names, groupIndex) {
    var groupId = 'exclusive-' + groupIndex;
    freeCollectibles.filter(function (item) { return names.indexOf(item.name) >= 0; }).forEach(function (item) { freeExclusiveGroupById[item.id] = groupId; });
  });
  var state = loadState();
  var initialCalendarDate = getReferenceDate();
  var FREE_PAGE_SIZE = 18;
  var CALENDAR_MINIMUM = '2024-12';
  var view = {
    mode: 'calendar', page: 'calendar', paidSearch: '', paidRange: 'all', paidStartDate: '', paidEndDate: '', paidStatus: 'all', paidRecordStatus: 'all', paidMethods: [], paidWheelIncludeVariantHair: true, paidListeningTypes: [], paidRetailPrices: [], paidHalfPricePrices: [], freeMode: 'catalog', freeLookupClassification: 'all', freeSearch: '', freeMissingOnly: false, freeCatalogFilter: 'all', freeAvailability: 'all', freeProgressScope: 'current', freeGender: state.freeGender === 'M' ? 'M' : 'F', freeVisibleLimit: FREE_PAGE_SIZE, selectedDate: '', editingPaid: {}, expandedSets: {},
    calendarYear: initialCalendarDate.getFullYear(), calendarMonth: initialCalendarDate.getMonth()
  };
  var shareState = { page: 0, pages: [], dataUrls: [], filterLabel: '全部时间' };
  var toastTimer = 0;
  var freeDateRefreshTimer = 0;
  var imagePreviewReturnFocus = null;

  var el = {
    paidCount: document.getElementById('paidCount'), freeCount: document.getElementById('freeCount'), freeSetCount: document.getElementById('freeSetCount'),
    viewSwitch: document.getElementById('viewSwitch'), calendarView: document.getElementById('calendarView'),
    listView: document.getElementById('listView'), calendarGrid: document.getElementById('calendarGrid'),
    calendarYearLabel: document.getElementById('calendarYearLabel'), calendarMonthPicker: document.getElementById('calendarMonthPicker'),
    previousMonthButton: document.getElementById('previousMonthButton'), nextMonthButton: document.getElementById('nextMonthButton'), calendarTodayButton: document.getElementById('calendarTodayButton'),
    monthOverviewButton: document.getElementById('monthOverviewButton'), calendarSelectionTitle: document.getElementById('calendarSelectionTitle'),
    calendarSelectionHint: document.getElementById('calendarSelectionHint'), calendarEmpty: document.getElementById('calendarEmpty'),
    scheduleList: document.getElementById('scheduleList'), paidList: document.getElementById('paidList'), paidSearchInput: document.getElementById('paidSearchInput'),
    paidRangeFilter: document.getElementById('paidRangeFilter'), paidStatusFilter: document.getElementById('paidStatusFilter'), paidMethodFilter: document.getElementById('paidMethodFilter'), paidMethodSummary: document.getElementById('paidMethodSummary'), paidMethodPanel: document.getElementById('paidMethodPanel'), paidMethodOptions: document.getElementById('paidMethodOptions'), clearPaidMethodsButton: document.getElementById('clearPaidMethodsButton'), paidMethodRefinements: document.getElementById('paidMethodRefinements'), paidWheelRefinement: document.getElementById('paidWheelRefinement'), paidWheelVariantHair: document.getElementById('paidWheelVariantHair'), paidListeningRefinement: document.getElementById('paidListeningRefinement'), paidListeningOptions: document.getElementById('paidListeningOptions'), paidRetailRefinement: document.getElementById('paidRetailRefinement'), paidRetailPriceOptions: document.getElementById('paidRetailPriceOptions'), paidHalfPriceRefinement: document.getElementById('paidHalfPriceRefinement'), paidHalfPriceOptions: document.getElementById('paidHalfPriceOptions'),
    paidCustomRange: document.getElementById('paidCustomRange'), paidStartDate: document.getElementById('paidStartDate'), paidEndDate: document.getElementById('paidEndDate'), applyPaidRangeButton: document.getElementById('applyPaidRangeButton'), paidRangeError: document.getElementById('paidRangeError'), paidResultHint: document.getElementById('paidResultHint'), paidListEmpty: document.getElementById('paidListEmpty'),
    monthStartCount: document.getElementById('monthStartCount'), monthEndCount: document.getElementById('monthEndCount'),
    recordProgress: document.getElementById('recordProgress'), statusSummary: document.getElementById('statusSummary'),
    freePage: document.getElementById('freePage'), freeModeSwitch: document.getElementById('freeModeSwitch'), freeMissionCard: document.getElementById('freeMissionCard'), freeMissionMissingCount: document.getElementById('freeMissionMissingCount'), freeMissionMissingCharm: document.getElementById('freeMissionMissingCharm'), freeMissionHint: document.getElementById('freeMissionHint'), freeProgressCard: document.getElementById('freeProgressCard'), freeRoutePanel: document.getElementById('freeRoutePanel'), freeRouteOptions: document.getElementById('freeRouteOptions'), freeRouteSubgroups: document.getElementById('freeRouteSubgroups'), freeSearchRow: document.getElementById('freeSearchRow'), freeSearchInput: document.getElementById('freeSearchInput'), freeMissingToggle: document.getElementById('freeMissingToggle'), freeCatalogToolbar: document.getElementById('freeCatalogToolbar'), freeResultTitle: document.getElementById('freeResultTitle'), freeResultSubtitle: document.getElementById('freeResultSubtitle'),
    freeFilters: document.getElementById('freeFilters'), freeAvailabilityFilters: document.getElementById('freeAvailabilityFilters'), freeGenderSwitch: document.getElementById('freeGenderSwitch'),
    categoryPickerButton: document.getElementById('categoryPickerButton'), selectedFreeCategoryLabel: document.getElementById('selectedFreeCategoryLabel'), freeFilterKindLabel: document.getElementById('freeFilterKindLabel'), freeFilterNote: document.getElementById('freeFilterNote'),
    freeResultCount: document.getElementById('freeResultCount'), categoryInlinePanel: document.getElementById('categoryInlinePanel'),
    selectFreeCategoryButton: document.getElementById('selectFreeCategoryButton'), freeList: document.getElementById('freeList'), freeLoadMoreButton: document.getElementById('freeLoadMoreButton'),
    freeCharmEarned: document.getElementById('freeCharmEarned'), freeCharmTotal: document.getElementById('freeCharmTotal'),
    freeOwnedCount: document.getElementById('freeOwnedCount'), freeTotalCount: document.getElementById('freeTotalCount'),
    freeCharmBar: document.getElementById('freeCharmBar'), freeProgressPercent: document.getElementById('freeProgressPercent'),
    freeProgressScope: document.getElementById('freeProgressScope'), freeProgressLabel: document.getElementById('freeProgressLabel'),
    freeProgressTotalLabel: document.getElementById('freeProgressTotalLabel'),
    freeEmpty: document.getElementById('freeEmpty'), generateShareButton: document.getElementById('generateShareButton'),
    shareBackdrop: document.getElementById('shareBackdrop'), closeShareButton: document.getElementById('closeShareButton'),
    shareCanvas: document.getElementById('shareCanvas'), shareImage: document.getElementById('shareImage'),
    previousSharePage: document.getElementById('previousSharePage'),
    nextSharePage: document.getElementById('nextSharePage'), sharePageTitle: document.getElementById('sharePageTitle'),
    sharePageLabel: document.getElementById('sharePageLabel'), saveShareButton: document.getElementById('saveShareButton'),
    saveAllShareButton: document.getElementById('saveAllShareButton'), toast: document.getElementById('toast'),
    imagePreviewBackdrop: document.getElementById('imagePreviewBackdrop'), imagePreviewImage: document.getElementById('imagePreviewImage'),
    imagePreviewCaption: document.getElementById('imagePreviewCaption'), closeImagePreviewButton: document.getElementById('closeImagePreviewButton')
  };

  function loadState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : { items: {} };
    } catch (error) { return { items: {} }; }
  }

  function ensureItemState(id) {
    if (!state.items) state.items = {};
    if (!state.items[id]) state.items[id] = { status: '', review: '', freeOwned: false };
    if (typeof state.items[id].freeOwned !== 'boolean') state.items[id].freeOwned = false;
    return state.items[id];
  }

  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function hueFor(item, index) {
    var sum = String(item.id || item.name || index).split('').reduce(function (total, char) { return total + char.charCodeAt(0); }, 0);
    return 28 + (sum % 72);
  }

  function prepareListImage(image, index) {
    image.loading = index < 2 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    return image;
  }

  function imageOrPlaceholder(item, index, gender) {
    var wrap = document.createElement('div');
    wrap.className = 'item-visual';
    if (String(item.sourceCommonImage || '').replace(/\\/g, '/').indexOf('/需要右移处理/') >= 0) {
      wrap.classList.add('is-shifted-right');
    }
    wrap.style.setProperty('--hue', hueFor(item, index));
    if (gender === 'F' || gender === 'M') {
      var selectedSource = item.commonImage || (gender === 'F' ? item.femaleImage : item.maleImage);
      if (selectedSource) {
        var selectedImage = document.createElement('img');
        var selectedLabel = item.commonImage ? '男女通用外观图' : (gender === 'F' ? '女号外观图' : '男号外观图');
        selectedImage.src = selectedSource; selectedImage.alt = item.name + selectedLabel; prepareListImage(selectedImage, index);
        wrap.appendChild(createImagePreviewButton(selectedImage, selectedSource, selectedImage.alt));
      } else {
        wrap.classList.add('is-placeholder');
        var genderMark = document.createElement('span'); genderMark.className = 'placeholder-mark'; genderMark.textContent = '◇';
        var genderLabel = document.createElement('small'); genderLabel.textContent = gender === 'F' ? '暂无女号图' : '暂无男号图';
        wrap.appendChild(genderMark); wrap.appendChild(genderLabel);
      }
    } else if (item.commonImage) {
      var commonImage = document.createElement('img');
      commonImage.src = item.commonImage; commonImage.alt = item.name + '通用外观图'; prepareListImage(commonImage, index);
      wrap.appendChild(createImagePreviewButton(commonImage, item.commonImage, commonImage.alt));
    } else if (item.femaleImage && item.maleImage) {
      wrap.classList.add('is-dual');
      [['女', item.femaleImage], ['男', item.maleImage]].forEach(function (entry) {
        var shot = document.createElement('button'); shot.type = 'button'; shot.className = 'gender-shot image-preview-button';
        shot.dataset.action = 'image-preview'; shot.dataset.previewSrc = entry[1]; shot.dataset.previewAlt = item.name + entry[0] + '号外观图';
        var genderImage = document.createElement('img'); genderImage.src = entry[1]; genderImage.alt = item.name + entry[0] + '号外观图'; prepareListImage(genderImage, index);
        shot.appendChild(genderImage); wrap.appendChild(shot);
      });
    } else if (item.femaleImage || item.maleImage) {
      var image = document.createElement('img');
      image.src = item.femaleImage || item.maleImage; image.alt = item.name + '外观图'; prepareListImage(image, index);
      wrap.appendChild(createImagePreviewButton(image, image.src, image.alt));
    } else {
      wrap.classList.add('is-placeholder');
      var mark = document.createElement('span'); mark.className = 'placeholder-mark'; mark.textContent = '◇';
      var label = document.createElement('small'); label.textContent = '待补图';
      wrap.appendChild(mark); wrap.appendChild(label);
    }
    return wrap;
  }

  function createImagePreviewButton(image, source, label) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'image-preview-button';
    button.dataset.action = 'image-preview'; button.dataset.previewSrc = source; button.dataset.previewAlt = label;
    button.setAttribute('aria-label', '查看大图：' + label);
    button.appendChild(image); return button;
  }

  function openImagePreview(source, label, trigger) {
    if (!source) return;
    imagePreviewReturnFocus = trigger || document.activeElement;
    el.imagePreviewImage.src = source; el.imagePreviewImage.alt = label || '外观大图';
    el.imagePreviewCaption.textContent = label || '外观大图';
    el.imagePreviewBackdrop.hidden = false; document.body.classList.add('is-previewing-image');
    el.closeImagePreviewButton.focus();
  }

  function closeImagePreview() {
    if (el.imagePreviewBackdrop.hidden) return;
    el.imagePreviewBackdrop.hidden = true; document.body.classList.remove('is-previewing-image');
    el.imagePreviewImage.removeAttribute('src');
    if (imagePreviewReturnFocus && typeof imagePreviewReturnFocus.focus === 'function') imagePreviewReturnFocus.focus();
    imagePreviewReturnFocus = null;
  }

  function listingClass(status) {
    if (status === '已下架' || status === '不可获取') return ' is-ended';
    if (status === '即将下架') return ' is-urgent';
    if (status === '预告') return ' is-preview';
    return '';
  }

  function makeMeta(text) {
    var span = document.createElement('span');
    span.className = 'meta-pill'; span.textContent = text || '待补充';
    return span;
  }

  function padNumber(value) { return String(value).padStart(2, '0'); }

  function dateKey(year, month, day) { return year + '-' + padNumber(month + 1) + '-' + padNumber(day); }

  function parseItemDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
  }

  function isLimitedPaidItem(item) {
    return item.listingStatus !== '常驻';
  }

  function compactDate(value) {
    var parts = parseItemDate(value);
    return parts ? parts.year + '.' + padNumber(parts.month + 1) + '.' + padNumber(parts.day) : '日期待补';
  }

  function paidPeriodLines(item) {
    if (!isLimitedPaidItem(item)) return [];
    var firstEnd = item.offSaleDate ? compactDate(item.offSaleDate) : (item.listingStatus === '已下架' ? '下架日期待补' : '截止待定');
    var lines = [(item.listingStatus === '预告' ? '预计在架 ' : '在架周期 ') + compactDate(item.onSaleDate) + '—' + firstEnd];
    if (item.returnStartDate || item.returnEndDate) {
      lines.push('返场周期 ' + (item.returnStartDate ? compactDate(item.returnStartDate) : '开始待定') + '—' + (item.returnEndDate ? compactDate(item.returnEndDate) : '截止待定'));
    }
    return lines;
  }

  function visibleSaleMethod(item) {
    return item.saleMethod === '待确认' ? '' : item.saleMethod;
  }

  function paidEventsForItem(item) {
    return item.onSaleDate ? [{ date: item.onSaleDate, type: item.listingStatus === '预告' ? 'preview' : 'launch', item: item }] : [];
  }

  // 同一天档期较多时，使用固定的“价值／活动捆绑”顺序，避免每次加载顺序漂移。
  // 直售类共享一个价格优先区间：先按最终价格降序，同价时再按售卖方式顺序。
  var PAID_VALUE_ORDER = ['画舫套装', '氪条奖励', '周年转盘', '聆音', '聆音预热战令', '和鸣大套', '八音发', '转盘', '战令', '原价直售', '折扣直售', '限时直售', '限时折扣直售', '限时半价', '6r小战令'];
  // 获取筛选沿用服装价值顺序，但把八音发拆成双八音发与单八音发。
  var PAID_FILTER_ORDER = ['画舫套装', '氪条奖励', '周年转盘', '聆音', '聆音预热战令', '和鸣大套', '双八音发', '单八音发', '转盘', '战令', '原价直售', '折扣直售', '限时直售', '限时半价', '6r小战令'];
  var paidBundleMap = null;
  function isDirectSale(item) { return ['原价直售', '限时直售', '限时折扣直售', '限时半价', '折扣直售'].indexOf(item.saleMethod) >= 0; }
  function paidMethodRank(item) {
    var method = String(item.saleMethod || '');
    if (method === '待确认') return 99;
    var index = PAID_VALUE_ORDER.indexOf(method);
    if (index >= 0) return index;
    var tagText = (item.styleTags || []).join('、');
    if (tagText.indexOf('双八音') >= 0) return PAID_VALUE_ORDER.indexOf('八音发');
    if (tagText.indexOf('单八音') >= 0) return PAID_VALUE_ORDER.indexOf('原价直售');
    return 90;
  }
  function paidFilterMethod(item) {
    var method = visibleSaleMethod(item);
    if (method === '限时折扣直售') return '限时直售';
    if (method !== '八音发') return method;
    return (item.styleTags || []).indexOf('双八音发') >= 0 ? '双八音发' : '单八音发';
  }
  function getPaidBundleMap() {
    if (paidBundleMap) return paidBundleMap;
    paidBundleMap = {};
    var sourceRows = paidItems.slice().sort(function (a, b) { return Number(a.sourceOrder || 0) - Number(b.sourceOrder || 0); });
    sourceRows.forEach(function (hair, index) {
      if (hair.saleMethod !== '八音发' || (hair.styleTags || []).indexOf('单八音发') < 0) return;
      var retail = sourceRows[index - 1];
      if (!retail || retail.onSaleDate !== hair.onSaleDate || !isDirectSale(retail)) return;
      var price = Number(String(retail.priceOriginal || '').replace(/\D/g, '')) || 0;
      var rank = paidMethodRank(retail);
      paidBundleMap[retail.id] = { groupId: retail.id, role: 0, price: price, rank: rank, sourceOrder: retail.sourceOrder };
      paidBundleMap[hair.id] = { groupId: retail.id, role: 1, price: price, rank: rank, sourceOrder: retail.sourceOrder };
    });
    return paidBundleMap;
  }
  function paidBundleInfo(item) { return getPaidBundleMap()[item.id] || null; }
  function paidValueRank(item) {
    var bundle = paidBundleInfo(item);
    return bundle ? bundle.rank : paidMethodRank(item);
  }
  function paidListeningRank(item) {
    var tags = item.styleTags || [];
    if (tags.indexOf('大套') >= 0) return 0;
    if (tags.indexOf('小套') >= 0) return 1;
    if (tags.indexOf('异色发') >= 0) return 2;
    return 3;
  }
  function paidEffectiveRetailPrice(item) {
    var bundle = paidBundleInfo(item);
    return bundle ? bundle.price : (Number(String(item.priceOriginal || '').replace(/\D/g, '')) || 0);
  }
  function comparePaidSameDate(a, b) {
    var bundleA = paidBundleInfo(a.item);
    var bundleB = paidBundleInfo(b.item);
    var directA = Boolean(bundleA || isDirectSale(a.item));
    var directB = Boolean(bundleB || isDirectSale(b.item));
    var rankDiff = paidValueRank(a.item) - paidValueRank(b.item);
    if (directA && directB) {
      var retailPriceDiff = paidEffectiveRetailPrice(b.item) - paidEffectiveRetailPrice(a.item);
      if (retailPriceDiff) return retailPriceDiff;
      if (rankDiff) return rankDiff;
    } else if (rankDiff) {
      return rankDiff;
    }
    if (a.item.saleMethod === '聆音' && b.item.saleMethod === '聆音') {
      var listeningDiff = paidListeningRank(a.item) - paidListeningRank(b.item);
      if (listeningDiff) return listeningDiff;
    }
    if (bundleA || bundleB) {
      var orderA = Number(bundleA ? bundleA.sourceOrder : a.item.sourceOrder) || 0;
      var orderB = Number(bundleB ? bundleB.sourceOrder : b.item.sourceOrder) || 0;
      var groupDiff = orderA - orderB;
      if (groupDiff) return groupDiff;
      return (bundleA ? bundleA.role : 2) - (bundleB ? bundleB.role : 2);
    }
    return String(a.item.id || a.item.name).localeCompare(String(b.item.id || b.item.name), 'zh-CN');
  }

  function paidEventsForMonth(year, month) {
    return paidItems.reduce(function (events, item) { return events.concat(paidEventsForItem(item)); }, []).filter(function (event) {
      var parts = parseItemDate(event.date); return parts && parts.year === year && parts.month === month;
    }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || comparePaidSameDate(a, b); });
  }

  function renderCalendar() {
    var year = view.calendarYear; var month = view.calendarMonth; var monthEvents = paidEventsForMonth(year, month); var eventsByDate = {};
    monthEvents.forEach(function (event) { if (!eventsByDate[event.date]) eventsByDate[event.date] = []; eventsByDate[event.date].push(event); });
    el.monthStartCount.textContent = monthEvents.length;
    var endedItemIds = {};
    monthEvents.forEach(function (event) {
      if (event.item.listingStatus === '已下架') endedItemIds[event.item.id] = true;
    });
    el.monthEndCount.textContent = Object.keys(endedItemIds).length;
    var currentMonthKey = year + '-' + padNumber(month + 1);
    el.calendarYearLabel.textContent = year + ' · 外观档期'; el.calendarMonthPicker.value = currentMonthKey;
    el.calendarMonthPicker.min = CALENDAR_MINIMUM;
    el.previousMonthButton.disabled = currentMonthKey <= CALENDAR_MINIMUM;
    el.calendarGrid.setAttribute('aria-label', year + '年' + (month + 1) + '月服装日历'); el.calendarGrid.replaceChildren();
    var firstWeekday = new Date(year, month, 1).getDay(); var daysInMonth = new Date(year, month + 1, 0).getDate();
    var previousMonthDays = new Date(year, month, 0).getDate(); var today = new Date(); var todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    for (var index = 0; index < 42; index += 1) {
      var cellDay = index - firstWeekday + 1; var cellYear = year; var cellMonth = month; var muted = false;
      if (cellDay < 1) { cellDay = previousMonthDays + cellDay; cellMonth -= 1; muted = true; }
      else if (cellDay > daysInMonth) { cellDay -= daysInMonth; cellMonth += 1; muted = true; }
      if (cellMonth < 0) { cellMonth = 11; cellYear -= 1; } else if (cellMonth > 11) { cellMonth = 0; cellYear += 1; }
      var key = dateKey(cellYear, cellMonth, cellDay);
      el.calendarGrid.appendChild(makeDay(cellDay, key, muted, eventsByDate[key] || [], key === todayKey));
    }
    renderCalendarSelection();
  }

  function makeDay(day, key, muted, events, isToday) {
    var eventCount = events.length;
    var previewCount = events.filter(function (event) { return event.item.listingStatus === '预告'; }).length;
    var confirmedCount = eventCount - previewCount;
    var cell = document.createElement('button'); cell.type = 'button'; cell.dataset.date = key;
    cell.className = 'calendar-day' + (muted ? ' is-muted' : '') + (eventCount ? ' has-event' : '') + (previewCount ? ' has-preview' : '') + (confirmedCount ? ' has-confirmed' : '') + (isToday ? ' is-today' : '') + (view.selectedDate === key ? ' is-selected' : '');
    cell.setAttribute('aria-label', key.replace(/-(\d{2})-(\d{2})$/, '年$1月$2日') + (eventCount ? '，有' + eventCount + '条服装信息' + (previewCount ? '，其中预告' + previewCount + '条' : '') : '，无服装信息'));
    var span = document.createElement('span'); span.textContent = day; cell.appendChild(span); return cell;
  }

  function createPaidCard(item, index, context, calendarEvent) {
    var saved = ensureItemState(item.id); var card = document.createElement('article'); card.className = 'outfit-card'; card.dataset.id = item.id;
    var core = document.createElement('div'); core.className = 'outfit-core'; core.appendChild(imageOrPlaceholder(item, index));
    var info = document.createElement('div'); info.className = 'item-info'; var titleRow = document.createElement('div'); titleRow.className = 'item-title-row';
    titleRow.innerHTML = '<h3>' + escapeHtml(item.name) + '</h3><span class="listing-pill' + listingClass(item.listingStatus) + '">' + escapeHtml(item.listingStatus) + '</span>'; info.appendChild(titleRow);
    var date = document.createElement('p'); date.className = 'item-date';
    var periodLines = paidPeriodLines(item);
    if (periodLines.length) periodLines.forEach(function (line) { var period = document.createElement('span'); period.textContent = line; date.appendChild(period); });
    else date.textContent = formatDate(item.onSaleDate) + ' 上架';
    info.appendChild(date);
    var keyFacts = document.createElement('dl'); keyFacts.className = 'paid-keyfacts';
    function appendPaidFact(label, values, modifier) {
      var row = document.createElement('div'); row.className = 'paid-keyfact' + (modifier ? ' ' + modifier : '');
      var term = document.createElement('dt'); term.textContent = label;
      var detail = document.createElement('dd');
      var list = (Array.isArray(values) ? values : [values]).filter(Boolean);
      if (!list.length) { detail.className = 'is-empty'; detail.textContent = '暂无'; }
      else list.forEach(function (value) { var tag = document.createElement('span'); tag.textContent = value; detail.appendChild(tag); });
      row.appendChild(term); row.appendChild(detail); keyFacts.appendChild(row);
    }
    appendPaidFact('服装属性', visibleSaleMethod(item) || item.type);
    appendPaidFact('风格标签', item.styleTags || []);
    if (item.priceOriginal) appendPaidFact('直售价格', item.priceOriginal, 'is-price');
    info.appendChild(keyFacts);
    core.appendChild(info); card.appendChild(core);
    if (saved.status && !view.editingPaid[item.id]) {
      var recordSummary = document.createElement('div'); recordSummary.className = 'paid-record-summary';
      var resultTags = document.createElement('div'); resultTags.className = 'paid-result-tags';
      var statusTag = document.createElement('span'); statusTag.className = 'paid-result-tag is-status'; statusTag.textContent = STATUS[saved.status] || saved.status;
      var reviewTag = document.createElement('span'); reviewTag.className = 'paid-result-tag is-review' + (saved.review ? '' : ' is-empty'); reviewTag.textContent = saved.review || '未写短评';
      var editButton = document.createElement('button'); editButton.type = 'button'; editButton.className = 'paid-edit-button'; editButton.dataset.action = 'edit-record'; editButton.dataset.id = item.id; editButton.textContent = '修改';
      resultTags.appendChild(statusTag); resultTags.appendChild(reviewTag); recordSummary.appendChild(resultTags); recordSummary.appendChild(editButton); card.appendChild(recordSummary); return card;
    }
    view.editingPaid[item.id] = true;
    var choices = document.createElement('div'); choices.className = 'choice-row';
    Object.keys(STATUS).forEach(function (key) {
      var button = document.createElement('button'); button.type = 'button'; button.className = 'choice-button' + (saved.status === key ? ' is-active' : '');
      button.dataset.action = 'status'; button.dataset.status = key; button.dataset.id = item.id; button.textContent = STATUS[key]; choices.appendChild(button);
    });
    card.appendChild(choices); var reviewRow = document.createElement('div'); reviewRow.className = 'review-row'; var inputId = 'review-' + context + '-' + item.id;
    reviewRow.innerHTML = '<label for="' + inputId + '">自定义短评</label><input id="' + inputId + '" maxlength="18" value="' + escapeAttribute(saved.review || '') + '" placeholder="例如：丑拒 / 误闯天家"><small>' + String((saved.review || '').length) + '/18</small>';
    reviewRow.querySelector('input').dataset.id = item.id;
    var completeButton = document.createElement('button'); completeButton.type = 'button'; completeButton.className = 'paid-complete-button'; completeButton.dataset.action = 'complete-record'; completeButton.dataset.id = item.id; completeButton.textContent = '完成'; completeButton.disabled = !saved.status;
    reviewRow.appendChild(completeButton); card.appendChild(reviewRow); return card;
  }

  function renderCalendarSelection() {
    var monthEvents = paidEventsForMonth(view.calendarYear, view.calendarMonth); var visible = monthEvents;
    el.scheduleList.replaceChildren(); el.scheduleList.classList.toggle('is-detail', Boolean(view.selectedDate)); el.monthOverviewButton.classList.toggle('is-active', !view.selectedDate);
    if (view.selectedDate) {
      visible = monthEvents.filter(function (event) { return event.date === view.selectedDate; });
      var selectedParts = parseItemDate(view.selectedDate); el.calendarSelectionTitle.textContent = (selectedParts.month + 1) + '月' + selectedParts.day + '日档期';
      el.calendarSelectionHint.textContent = visible.length ? visible.length + ' 套外观' : '暂无外观';
      visible.forEach(function (event, index) { el.scheduleList.appendChild(createPaidCard(event.item, index, 'calendar', event)); });
    } else {
      el.calendarSelectionTitle.textContent = (view.calendarMonth + 1) + '月总览'; el.calendarSelectionHint.textContent = monthEvents.length + ' 条档期 · 按日期倒序';
      monthEvents.forEach(function (event) {
        var item = event.item; var row = document.createElement('button'); row.type = 'button'; row.className = 'schedule-item event-' + event.type; row.dataset.scheduleDate = event.date;
        var parts = parseItemDate(event.date);
        var compactFacts = Array.from(new Set([visibleSaleMethod(item) || item.type, item.priceTier].filter(Boolean))).join(' · ');
        var compactPeriods = paidPeriodLines(item);
        row.innerHTML = '<div class="date-block"><strong>' + parts.day + '</strong><span>' + (parts.month + 1) + '月</span></div>' +
          '<div class="schedule-copy"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(compactFacts) + '</span>' + (compactPeriods.length ? '<small class="schedule-period">' + escapeHtml(compactPeriods.join('；')) + '</small>' : '') + '</div>' +
          '<span class="schedule-state' + listingClass(item.listingStatus) + '">' + escapeHtml(item.listingStatus) + '</span>'; el.scheduleList.appendChild(row);
      });
    }
    el.calendarEmpty.hidden = visible.length > 0;
  }

  function setCalendarMonth(value) {
    var match = /^(\d{4})-(\d{2})$/.exec(String(value || '')); if (!match) return;
    var monthNumber = Number(match[2]); if (monthNumber < 1 || monthNumber > 12) return;
    var requestedMonth = match[1] + '-' + padNumber(monthNumber);
    var allowedMonth = requestedMonth < CALENDAR_MINIMUM ? CALENDAR_MINIMUM : requestedMonth;
    var allowedParts = /^(\d{4})-(\d{2})$/.exec(allowedMonth);
    view.calendarYear = Number(allowedParts[1]); view.calendarMonth = Number(allowedParts[2]) - 1; view.selectedDate = ''; renderCalendar(); renderPaidList();
  }

  function shiftCalendarMonth(offset) {
    var next = new Date(view.calendarYear, view.calendarMonth + offset, 1); setCalendarMonth(next.getFullYear() + '-' + padNumber(next.getMonth() + 1));
  }

  function goToToday() {
    var today = new Date();
    view.calendarYear = today.getFullYear(); view.calendarMonth = today.getMonth(); view.selectedDate = '';
    renderCalendar(); renderPaidList(); showToast('已回到今天');
  }

  function selectCalendarDate(key) {
    var parts = parseItemDate(key); if (!parts) return;
    if (key.slice(0, 7) < CALENDAR_MINIMUM) { showToast('日历最早从2024年12月开始'); return; }
    view.calendarYear = parts.year; view.calendarMonth = parts.month;
    var hasOutfit = paidEventsForMonth(parts.year, parts.month).some(function (event) { return event.date === key; });
    view.selectedDate = hasOutfit ? key : ''; renderCalendar();
    if (!hasOutfit) showToast('当天暂无外观，已显示月总览');
    el.calendarSelectionTitle.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderPaidList() {
    el.paidList.replaceChildren();
    var visible = getFilteredPaidItems();
    visible.forEach(function (item, index) { el.paidList.appendChild(createPaidCard(item, index, 'list')); });
    el.paidResultHint.textContent = paidRangeLabel(view.paidRange) + ' · 显示 ' + visible.length + '/' + paidListItems.length + ' 项';
    el.paidListEmpty.hidden = visible.length > 0;
    el.generateShareButton.disabled = visible.length === 0;
    renderStatusSummary(getFilteredPaidItems(true));
  }

  function getFilteredPaidItems(ignoreRecordStatus) {
    var query = view.paidSearch.toLowerCase();
    return paidListItems.filter(function (item) {
      var searchable = [item.name, item.priceOriginal].concat(item.styleTags || []).filter(Boolean).join(' ').toLowerCase();
      var matchesRecordStatus = ignoreRecordStatus || view.paidRecordStatus === 'all' || ensureItemState(item.id).status === view.paidRecordStatus;
      return paidItemMatchesRange(item, view.paidRange) && (!query || searchable.indexOf(query) >= 0) && (view.paidStatus === 'all' || item.listingStatus === view.paidStatus) && matchesRecordStatus && (!view.paidMethods.length || view.paidMethods.indexOf(paidFilterMethod(item)) >= 0) && paidItemMatchesMethodRefinements(item);
    }).sort(function (a, b) { return Number(b.sourceOrder || 0) - Number(a.sourceOrder || 0); });
  }

  function paidItemMatchesMethodRefinements(item) {
    var filterMethod = paidFilterMethod(item);
    if (view.paidMethods.indexOf(filterMethod) < 0) return true;
    var tags = item.styleTags || [];
    if (filterMethod === '转盘' && !view.paidWheelIncludeVariantHair && tags.indexOf('异色发') >= 0) return false;
    if (filterMethod === '聆音' && view.paidListeningTypes.length && !view.paidListeningTypes.some(function (type) { return tags.indexOf(type) >= 0; })) return false;
    if (filterMethod === '原价直售' && view.paidRetailPrices.length && view.paidRetailPrices.indexOf(item.priceOriginal) < 0) return false;
    if (filterMethod === '限时半价' && view.paidHalfPricePrices.length && view.paidHalfPricePrices.indexOf(item.priceOriginal) < 0) return false;
    return true;
  }

  function paidItemMatchesRange(item, range) {
    var itemDate = String(item.onSaleDate || ''); var parts = parseItemDate(itemDate); if (!parts) return false;
    if (range === 'all') return true;
    if (range === 'custom') return !view.paidStartDate || !view.paidEndDate ? true : itemDate >= view.paidStartDate && itemDate <= view.paidEndDate;
    var reference = new Date();
    if (parts.year !== reference.getFullYear()) return false;
    if (range === 'month') return parts.month === reference.getMonth();
    if (range === 'quarter') return Math.floor(parts.month / 3) === Math.floor(reference.getMonth() / 3);
    return range === 'year';
  }

  function paidRangeLabel(range) {
    var reference = new Date();
    if (range === 'month') return reference.getFullYear() + '年' + (reference.getMonth() + 1) + '月';
    if (range === 'quarter') return reference.getFullYear() + '年第' + (Math.floor(reference.getMonth() / 3) + 1) + '季度';
    if (range === 'year') return reference.getFullYear() + '年';
    if (range === 'custom') return view.paidStartDate && view.paidEndDate ? view.paidStartDate + ' 至 ' + view.paidEndDate : '自定义时间';
    return '全部时间';
  }

  function renderStatusSummary(items) {
    var scopedItems = items || paidItems;
    var counts = getCounts(scopedItems);
    var recorded = Object.keys(counts).reduce(function (total, key) { return total + counts[key]; }, 0);
    el.recordProgress.textContent = recorded + '/' + scopedItems.length;
    el.statusSummary.replaceChildren();
    Object.keys(STATUS).forEach(function (key) {
      var cell = document.createElement('button'); cell.type = 'button'; cell.className = 'summary-cell'; cell.dataset.statusFilter = key;
      cell.setAttribute('aria-pressed', view.paidRecordStatus === key ? 'true' : 'false');
      cell.innerHTML = '<strong>' + counts[key] + '</strong><span>' + STATUS[key] + '</span>'; el.statusSummary.appendChild(cell);
    });
  }

  function setPaidMethodPanelOpen(open) {
    el.paidMethodPanel.hidden = !open;
    el.generateShareButton.hidden = true;
    el.paidMethodFilter.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderPaidMethodSummary() {
    var labels = view.paidMethods.map(function (method) {
      if (method === '转盘' && !view.paidWheelIncludeVariantHair) return '转盘（不含异色发）';
      if (method === '聆音' && view.paidListeningTypes.length) return '聆音（' + view.paidListeningTypes.join('、') + '）';
      if (method === '原价直售' && view.paidRetailPrices.length) return '原价直售（' + view.paidRetailPrices.join('、') + '）';
      if (method === '限时半价' && view.paidHalfPricePrices.length) return '限时半价（' + view.paidHalfPricePrices.join('、') + '）';
      return method;
    });
    el.paidMethodSummary.hidden = !labels.length;
    el.paidMethodSummary.textContent = labels.length ? '获取：' + labels.join('；') : '';
    el.paidMethodFilter.classList.toggle('has-selection', view.paidMethods.length > 0);
  }

  function renderPaidMethodRefinements() {
    var wheel = view.paidMethods.indexOf('转盘') >= 0;
    var listening = view.paidMethods.indexOf('聆音') >= 0;
    var retail = view.paidMethods.indexOf('原价直售') >= 0;
    var halfPrice = view.paidMethods.indexOf('限时半价') >= 0;
    el.paidMethodRefinements.hidden = !(wheel || listening || retail || halfPrice);
    el.paidWheelRefinement.hidden = !wheel;
    el.paidListeningRefinement.hidden = !listening;
    el.paidRetailRefinement.hidden = !retail;
    el.paidHalfPriceRefinement.hidden = !halfPrice;
    el.paidWheelVariantHair.checked = view.paidWheelIncludeVariantHair;
    el.paidListeningOptions.querySelectorAll('input').forEach(function (input) { input.checked = view.paidListeningTypes.indexOf(input.value) >= 0; });
    el.paidRetailPriceOptions.querySelectorAll('input').forEach(function (input) { input.checked = view.paidRetailPrices.indexOf(input.value) >= 0; });
    el.paidHalfPriceOptions.querySelectorAll('input').forEach(function (input) { input.checked = view.paidHalfPricePrices.indexOf(input.value) >= 0; });
  }

  function applyCustomPaidRange() {
    var start = el.paidStartDate.value; var end = el.paidEndDate.value;
    if (!start || !end) {
      el.paidRangeError.textContent = '请选择完整的开始和结束日期'; el.paidRangeError.hidden = false; return;
    }
    if (start > end) {
      el.paidRangeError.textContent = '开始日期不能晚于结束日期'; el.paidRangeError.hidden = false; return;
    }
    view.paidStartDate = start; view.paidEndDate = end; el.paidRangeError.hidden = true; renderPaidList();
  }

  function hongKongDateKey(timestamp) {
    var shifted = new Date((timestamp == null ? Date.now() : timestamp) + 8 * 60 * 60 * 1000);
    return shifted.getUTCFullYear() + '-' + padNumber(shifted.getUTCMonth() + 1) + '-' + padNumber(shifted.getUTCDate());
  }

  function normaliseDateKey(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? match[1] + '-' + match[2] + '-' + match[3] : '';
  }

  function dateKeyDayNumber(value) {
    var parts = parseItemDate(normaliseDateKey(value));
    return parts ? Math.floor(Date.UTC(parts.year, parts.month, parts.day) / 86400000) : null;
  }

  function freeDaysRemaining(item, todayKey) {
    if (!item || item.listingStatus !== '限时') return null;
    var endDay = dateKeyDayNumber(item.endDate);
    var today = dateKeyDayNumber(todayKey || hongKongDateKey());
    return endDay == null || today == null ? null : endDay - today;
  }

  function effectiveFreeStatus(item, todayKey) {
    if (!item) return '';
    if (item.listingStatus === '限时') {
      var remaining = freeDaysRemaining(item, todayKey);
      return remaining != null && remaining < 0 ? '不可获取' : '限时';
    }
    return item.listingStatus;
  }

  function freeGroup(item, todayKey) {
    var status = effectiveFreeStatus(item, todayKey);
    if (status === '不可获取' || status === '已下架') return 'ended';
    if (status === '常驻') return 'permanent';
    if (status === '限时') return 'limited';
    return 'unknown';
  }

  function scheduleFreeDateRefresh() {
    if (freeDateRefreshTimer) clearTimeout(freeDateRefreshTimer);
    var now = Date.now();
    var shifted = new Date(now + 8 * 60 * 60 * 1000);
    var nextHongKongMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - 8 * 60 * 60 * 1000;
    freeDateRefreshTimer = setTimeout(function () {
      renderFreeList();
      scheduleFreeDateRefresh();
    }, Math.max(1000, nextHongKongMidnight - now + 1000));
  }

  function freeClassification(item) {
    var tags = (item && item.tags || []).filter(function (tag) { return tag && tag !== '套装' && tag !== '套装部件'; });
    var classification = tags[0] || '未分类';
    return FREE_CLASSIFICATION_ALIASES[classification] || classification;
  }

  function freeClassificationGroupValue(group) {
    return group.tags.length === 1 ? group.tags[0] : 'group:' + group.label;
  }

  function freeClassificationGroupForSelection(selection) {
    if (!selection || selection === 'all') return null;
    var groupLabel = selection.indexOf('group:') === 0 ? selection.slice(6) : '';
    return FREE_CLASSIFICATION_GROUPS.find(function (group) {
      return groupLabel ? group.label === groupLabel : group.tags.indexOf(selection) >= 0;
    }) || null;
  }

  function matchesFreeClassificationSelection(item, selection) {
    if (!selection || selection === 'all') return true;
    var classification = freeClassification(item);
    if (selection.indexOf('group:') !== 0) return classification === selection;
    var group = freeClassificationGroupForSelection(selection);
    return !!group && group.tags.indexOf(classification) >= 0;
  }

  function freeClassificationSelectionLabel(selection) {
    if (!selection || selection === 'all') return '全部分类组';
    var group = freeClassificationGroupForSelection(selection);
    return selection.indexOf('group:') === 0 && group ? group.label : selection;
  }

  function freeCatalogType(item) {
    if (item && item.recordShape === '套装') return '套装';
    return item && item.type || '其他';
  }

  function activeFreeFilter() {
    return view.freeCatalogFilter;
  }

  function freeFilterLabel(value) {
    if (value === 'all') return '全部分类';
    return FREE_CATALOG_TYPE_LABELS[value] || value;
  }

  function matchesFreeGender(item) {
    if (!item) return false;
    if (item.recordShape === '套装') {
      return freeCollectibles.some(function (child) {
        if (child.parentSetId !== item.id) return false;
        return Boolean(child.commonImage || (view.freeGender === 'M' ? child.maleImage : child.femaleImage));
      });
    }
    if (item.commonImage) return true;
    return view.freeGender === 'M' ? Boolean(item.maleImage) : Boolean(item.femaleImage);
  }

  function childrenForSet(setId, genderAware) {
    return freeCollectibles.slice().filter(function (item) {
      return item.parentSetId === setId && (!genderAware || matchesFreeGender(item));
    })
      .sort(function (a, b) { return Number(a.partOrder || 0) - Number(b.partOrder || 0); });
  }

  function maxFreeCopies(item) {
    var value = Math.floor(Number(item && item.maxObtainableCount));
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function getFreeOwnedCount(item) {
    if (!item || item.recordShape === '套装') return 0;
    var itemState = ensureItemState(item.id);
    var count = Number(itemState.freeOwnedCount);
    if (!Number.isFinite(count)) count = itemState.freeOwned ? 1 : 0;
    count = Math.max(0, Math.min(maxFreeCopies(item), Math.floor(count)));
    itemState.freeOwnedCount = count;
    itemState.freeOwned = count > 0;
    return count;
  }

  function exclusiveGroupFor(item) {
    return item ? freeExclusiveGroupById[item.id] || '' : '';
  }

  function exclusiveGroupItems(item) {
    var group = exclusiveGroupFor(item);
    if (!group) return [];
    return freeCollectibles.filter(function (entry) { return freeExclusiveGroupById[entry.id] === group; });
  }

  function exclusiveSelectedItem(item) {
    return exclusiveGroupItems(item).find(function (entry) { return getFreeOwnedCount(entry) > 0; }) || null;
  }

  function setFreeOwnedCount(item, nextCount) {
    if (!item || item.recordShape === '套装') return [];
    var count = Math.max(0, Math.min(maxFreeCopies(item), Math.floor(Number(nextCount) || 0)));
    var cleared = [];
    if (count > 0 && exclusiveGroupFor(item)) {
      exclusiveGroupItems(item).forEach(function (peer) {
        if (peer.id === item.id || getFreeOwnedCount(peer) === 0) return;
        var peerState = ensureItemState(peer.id);
        peerState.freeOwnedCount = 0;
        peerState.freeOwned = false;
        cleared.push(peer.name);
      });
    }
    var itemState = ensureItemState(item.id);
    itemState.freeOwnedCount = count;
    itemState.freeOwned = count > 0;
    return cleared;
  }

  function isFreeOwned(item) {
    if (item.recordShape === '套装') {
      var children = childrenForSet(item.id, true);
      return children.length > 0 && children.every(isFreeOwned);
    }
    return getFreeOwnedCount(item) >= maxFreeCopies(item);
  }

  function isFreeRequirementComplete(item) {
    if (isFreeOwned(item)) return true;
    return Boolean(exclusiveGroupFor(item) && exclusiveSelectedItem(item));
  }

  function hasAnyFreeOwnership(item) {
    if (item.recordShape === '套装') {
      return childrenForSet(item.id, true).some(function (child) { return getFreeOwnedCount(child) > 0; });
    }
    return getFreeOwnedCount(item) > 0 || Boolean(exclusiveGroupFor(item) && exclusiveSelectedItem(item));
  }

  function setFreeOwned(item, target) {
    if (item.recordShape === '套装') {
      childrenForSet(item.id, true).forEach(function (child) { setFreeOwnedCount(child, target ? maxFreeCopies(child) : 0); });
      return;
    }
    setFreeOwnedCount(item, target ? maxFreeCopies(item) : 0);
  }

  function freeSearchMatches(item) {
    if (!view.freeSearch) return true;
    var parentSet = item.parentSetId ? freeSetById[item.parentSetId] : null;
    var searchable = [item.name, item.type, item.rawType, item.channel, item.source, item.note, parentSet && parentSet.name].concat(item.tags || []).filter(Boolean).join(' ').toLowerCase();
    return searchable.indexOf(view.freeSearch.toLowerCase()) >= 0;
  }

  function freeAvailabilityRank(item) {
    var group = freeGroup(item);
    if (group === 'limited') return 0;
    if (group === 'permanent') return 1;
    if (group === 'ended') return 2;
    return 3;
  }

  function getVisibleFreeItems() {
    var sourceItems = freeItems.filter(function (item) { return item.recordShape !== '套装部件'; });
    var prioritiseDeadline = view.freeAvailability === 'limited';
    var todayKey = prioritiseDeadline ? hongKongDateKey() : '';
    return sourceItems.filter(function (item) {
      if (!matchesFreeGender(item) || !freeSearchMatches(item)) return false;
      if (view.freeMode === 'lookup') {
        if (!matchesFreeClassificationSelection(item, view.freeLookupClassification)) return false;
        if (view.freeMissingOnly && isFreeRequirementComplete(item)) return false;
      }
      var selectedFilter = activeFreeFilter();
      var itemFilter = freeCatalogType(item);
      var matchesCategory = selectedFilter === 'all' || itemFilter === selectedFilter;
      var matchesAvailability = view.freeAvailability === 'all' || freeGroup(item) === view.freeAvailability;
      return matchesCategory && matchesAvailability;
    }).sort(function (a, b) {
      if (prioritiseDeadline) {
        var aRemaining = freeDaysRemaining(a, todayKey);
        var bRemaining = freeDaysRemaining(b, todayKey);
        var deadlineDifference = (aRemaining == null ? Infinity : aRemaining) - (bRemaining == null ? Infinity : bRemaining);
        if (deadlineDifference) return deadlineDifference;
      }
      return charmValue(b) - charmValue(a) || freeAvailabilityRank(a) - freeAvailabilityRank(b) || String(a.name).localeCompare(String(b.name), 'zh-CN');
    });
  }

  function charmValue(item) {
    var value = Number(item && item.charmValue);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('zh-CN');
  }

  function isCurrentlyAvailable(item) {
    var group = freeGroup(item);
    return group === 'limited' || group === 'permanent';
  }

  function getFreeCharmProgress() {
    var genderItems = freeCollectibles.filter(matchesFreeGender);
    var currentItems = genderItems.filter(isCurrentlyAvailable);
    var unavailableItems = genderItems.filter(function (item) { return freeGroup(item) === 'ended'; });
    var current = summarizeFreeItems(currentItems);
    var all = summarizeFreeItems(genderItems);
    var unavailable = summarizeFreeItems(unavailableItems);
    return {
      earned: current.earnedCharm,
      total: current.totalCharm,
      ownedCount: current.ownedCount,
      totalCount: current.totalCount,
      remainingCount: current.remainingCount,
      remainingCharm: current.remainingCharm,
      percent: current.totalCharm > 0 ? Math.min(100, Math.round(current.earnedCharm / current.totalCharm * 100)) : 0,
      allEarned: all.earnedCharm,
      allTotal: all.totalCharm,
      allOwnedCount: all.ownedCount,
      allTotalCount: all.totalCount,
      allRemainingCount: all.remainingCount,
      allRemainingCharm: all.remainingCharm,
      unavailableCount: unavailable.totalCount,
      unavailableTotal: unavailable.totalCharm
    };
  }

  function summarizeFreeItems(items) {
    var summary = { earnedCharm: 0, totalCharm: 0, ownedCount: 0, totalCount: 0, remainingCount: 0, remainingCharm: 0 };
    var seenGroups = {};
    items.forEach(function (item) {
      var group = exclusiveGroupFor(item);
      if (group) {
        if (seenGroups[group]) return;
        seenGroups[group] = true;
        var choices = items.filter(function (entry) { return exclusiveGroupFor(entry) === group; });
        var selected = choices.find(function (entry) { return getFreeOwnedCount(entry) > 0; });
        var groupCharm = choices.reduce(function (best, entry) { return Math.max(best, charmValue(entry)); }, 0);
        summary.totalCount += 1;
        summary.totalCharm += groupCharm;
        if (selected) {
          summary.ownedCount += 1;
          summary.earnedCharm += charmValue(selected);
        } else {
          summary.remainingCount += 1;
          summary.remainingCharm += groupCharm;
        }
        return;
      }
      var max = maxFreeCopies(item);
      var owned = getFreeOwnedCount(item);
      summary.totalCount += max;
      summary.ownedCount += owned;
      summary.totalCharm += charmValue(item) * max;
      summary.earnedCharm += charmValue(item) * owned;
      summary.remainingCount += max - owned;
      summary.remainingCharm += charmValue(item) * (max - owned);
    });
    return summary;
  }

  function renderFreeCharmProgress() {
    var progress = getFreeCharmProgress();
    var isAll = view.freeProgressScope === 'all';
    el.freeProgressScope.querySelectorAll('[data-progress-scope]').forEach(function (button) {
      var active = button.dataset.progressScope === view.freeProgressScope;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var shown = isAll ? {
      earned: progress.allEarned,
      total: progress.allTotal,
      ownedCount: progress.allOwnedCount,
      totalCount: progress.allTotalCount,
      percent: progress.allTotal > 0 ? Math.min(100, Math.round(progress.allEarned / progress.allTotal * 100)) : 0
    } : progress;
    el.freeCharmEarned.textContent = formatNumber(shown.earned);
    el.freeCharmTotal.textContent = formatNumber(shown.total);
    el.freeOwnedCount.textContent = shown.ownedCount;
    el.freeTotalCount.textContent = shown.totalCount;
    el.freeCharmBar.style.width = shown.percent + '%';
    el.freeProgressLabel.textContent = isAll ? '全部图鉴总风华' : '当前可得总风华';
    el.freeProgressTotalLabel.textContent = isAll ? '全部图鉴总风华' : '当前可得总风华';
    el.freeProgressPercent.textContent = shown.percent === 100 ? (isAll ? '全部图鉴已收集完成' : '当前可得已收集完成') : (isAll ? '图鉴进度 ' : '当前进度 ') + shown.percent + '%';
    el.freeCharmBar.parentElement.setAttribute('aria-valuenow', String(shown.percent));
    el.freeCharmBar.parentElement.setAttribute('aria-label', isAll ? '全部图鉴风华收集进度' : '当前可得风华收集进度');
  }

  function switchFreeProgressScope(scope) {
    if (scope !== 'current' && scope !== 'all') return;
    view.freeProgressScope = scope;
    el.freeProgressScope.querySelectorAll('[data-progress-scope]').forEach(function (button) {
      var active = button.dataset.progressScope === scope;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    renderFreeCharmProgress();
  }

  function switchFreeGender(gender) {
    if (gender !== 'F' && gender !== 'M') return;
    view.freeGender = gender;
    view.freeVisibleLimit = FREE_PAGE_SIZE;
    state.freeGender = gender;
    persist();
    el.freeGenderSwitch.querySelectorAll('[data-free-gender]').forEach(function (button) {
      var active = button.dataset.freeGender === gender;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    renderFreeList();
    showToast(gender === 'F' ? '已切换为女号外观' : '已切换为男号外观');
  }

  function freeStatusLabel(item, todayKey) {
    var group = freeGroup(item, todayKey);
    if (group === 'permanent') return '常驻';
    if (group === 'ended') return '不可获取';
    if (group === 'limited') {
      var remaining = freeDaysRemaining(item, todayKey);
      if (remaining === 0) return '限时 · 今日结束';
      if (remaining > 0) return '限时 · 剩' + remaining + '天';
      return '限时可得';
    }
    return '待标注';
  }

  function freeStatusPillClass(item) {
    return listingClass(effectiveFreeStatus(item));
  }

  function createFreeToggle(item, labelWhenOff, labelWhenOn, extraClass) {
    var owned = isFreeOwned(item);
    var exclusiveSelected = exclusiveSelectedItem(item);
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'choice-button free-owned-button' + (extraClass ? ' ' + extraClass : '') + (owned ? ' is-active' : '') + (exclusiveGroupFor(item) ? ' is-exclusive-choice' : '');
    toggle.dataset.action = 'free-owned'; toggle.dataset.id = item.id;
    toggle.setAttribute('aria-pressed', owned ? 'true' : 'false');
    toggle.textContent = exclusiveGroupFor(item) ? (owned ? '已选择 ✓' : (exclusiveSelected ? '改选此武器' : '选择此武器')) : (owned ? labelWhenOn : labelWhenOff);
    return toggle;
  }

  function createFreeCopiesControl(item, extraClass) {
    var max = maxFreeCopies(item);
    var owned = getFreeOwnedCount(item);
    var wrap = document.createElement('fieldset');
    wrap.className = 'free-copy-control' + (extraClass ? ' ' + extraClass : '');
    var legend = document.createElement('legend');
    legend.innerHTML = '<span>获得进度</span><b>' + owned + '/' + max + ' 件</b>';
    wrap.appendChild(legend);
    var checks = document.createElement('div'); checks.className = 'free-copy-checks';
    for (var copyIndex = 1; copyIndex <= max; copyIndex += 1) {
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'checkbox'; input.checked = copyIndex <= owned;
      input.dataset.action = 'free-copy'; input.dataset.id = item.id; input.dataset.copyIndex = String(copyIndex);
      input.setAttribute('aria-label', item.name + '第' + copyIndex + '件');
      var mark = document.createElement('span'); mark.textContent = String(copyIndex);
      label.appendChild(input); label.appendChild(mark); checks.appendChild(label);
    }
    wrap.appendChild(checks);
    var hint = document.createElement('small'); hint.textContent = '每获得一件就勾选一格'; wrap.appendChild(hint);
    return wrap;
  }

  function createExclusiveChoiceNote(item) {
    if (!exclusiveGroupFor(item)) return null;
    var selected = exclusiveSelectedItem(item);
    var note = document.createElement('p'); note.className = 'free-exclusive-note';
    note.textContent = selected ? '剑枪二选一 · 当前选择：' + selected.name : '剑枪二选一 · 只能选择其中一把';
    return note;
  }

  function createFreeSetCard(item, index) {
    var children = childrenForSet(item.id, true); var ownedCount = children.filter(isFreeOwned).length;
    var isExpanded = Boolean(view.expandedSets[item.id]);
    var card = document.createElement('article'); card.className = 'free-card free-set-card' + (isExpanded ? ' is-expanded' : ''); card.dataset.id = item.id;
    var hero = document.createElement('div'); hero.className = 'free-set-hero'; hero.appendChild(imageOrPlaceholder(item, index, view.freeGender));
    var info = document.createElement('div'); info.className = 'free-set-info';
    info.innerHTML = '<div class="item-title-row"><h3>' + escapeHtml(item.name) + '</h3><span class="listing-pill' + freeStatusPillClass(item) + '">' + freeStatusLabel(item) + '</span></div>';
    var meta = document.createElement('div'); meta.className = 'meta-row';
    var charm = document.createElement('span'); charm.className = 'free-charm-pill'; charm.textContent = '✦ ' + formatNumber(charmValue(item)) + ' 风华'; meta.appendChild(charm);
    meta.appendChild(makeMeta(item.rawType || item.type));
    meta.appendChild(makeMeta(children.length + ' 个部件'));
    meta.appendChild(makeMeta(freeClassification(item)));
    info.appendChild(meta);
    var progress = document.createElement('p'); progress.className = 'set-owned-progress'; progress.textContent = '已获得 ' + ownedCount + '/' + children.length + ' 个部件'; info.appendChild(progress);
    var actions = document.createElement('div'); actions.className = 'set-card-actions';
    actions.appendChild(createFreeToggle(item, '标记整套获得', '整套已获得 ✓', 'set-owned-button'));
    var expandButton = document.createElement('button');
    expandButton.type = 'button'; expandButton.className = 'choice-button set-expand-button';
    expandButton.dataset.action = 'toggle-set-parts'; expandButton.dataset.id = item.id;
    expandButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    expandButton.setAttribute('aria-controls', 'set-parts-' + item.id);
    expandButton.textContent = isExpanded ? '收起组件' : '展开组件'; actions.appendChild(expandButton);
    info.appendChild(actions); hero.appendChild(info); card.appendChild(hero);

    var overviewSection = document.createElement('section'); overviewSection.className = 'set-part-overview-section';
    overviewSection.id = 'set-parts-' + item.id; overviewSection.hidden = !isExpanded;
    var overviewHeading = document.createElement('div'); overviewHeading.className = 'set-part-overview-heading';
    overviewHeading.innerHTML = '<div><strong>套装组件</strong><span>图片、风华与获取方式</span></div><b>' + children.length + ' 件</b>';
    overviewSection.appendChild(overviewHeading);
    var overview = document.createElement('div'); overview.className = 'set-part-overview';
    children.forEach(function (child, childIndex) {
      var cell = document.createElement('article'); cell.className = 'set-part-summary' + (isFreeOwned(child) ? ' is-owned' : ''); cell.dataset.id = child.id;
      var visual = imageOrPlaceholder(child, index * 10 + childIndex + 1, view.freeGender); visual.classList.add('set-part-summary-visual'); cell.appendChild(visual);
      var body = document.createElement('div'); body.className = 'set-part-summary-body';
      var titleRow = document.createElement('div'); titleRow.className = 'set-part-summary-title';
      titleRow.innerHTML = '<span>' + escapeHtml(child.rawType || child.type || '部件') + '</span><i>' + (isFreeOwned(child) ? '已获得' : '未获得') + '</i>'; body.appendChild(titleRow);
      var name = document.createElement('b'); name.textContent = child.name; body.appendChild(name);
      var charmLine = document.createElement('em'); charmLine.textContent = '✦ ' + formatNumber(charmValue(child)) + ' 风华'; body.appendChild(charmLine);
      var route = document.createElement('p'); route.className = 'set-part-summary-route'; route.textContent = '获取：' + (child.source || child.note || child.channel || '待补充'); body.appendChild(route);
      if (maxFreeCopies(child) > 1) body.appendChild(createFreeCopiesControl(child, 'set-summary-copies'));
      else body.appendChild(createFreeToggle(child, '标记已获得', '已获得 ✓', 'set-summary-toggle'));
      cell.appendChild(body); overview.appendChild(cell);
    });
    overviewSection.appendChild(overview); card.appendChild(overviewSection);
    return card;
  }

  function createFreeItemCard(item, index) {
    var multiCopy = maxFreeCopies(item) > 1;
    var card = document.createElement('article'); card.className = 'free-card' + (multiCopy ? ' is-multi-copy' : '') + (getFreeOwnedCount(item) > 0 && !isFreeOwned(item) ? ' is-partially-owned' : ''); card.dataset.id = item.id; card.appendChild(imageOrPlaceholder(item, index, view.freeGender));
    var info = document.createElement('div'); info.className = 'item-info';
    info.innerHTML = '<div class="item-title-row"><h3>' + escapeHtml(item.name) + '</h3><span class="listing-pill' + freeStatusPillClass(item) + '">' + freeStatusLabel(item) + '</span></div>';
    var meta = document.createElement('div'); meta.className = 'meta-row';
    var charm = document.createElement('span'); charm.className = 'free-charm-pill'; charm.textContent = '✦ ' + formatNumber(charmValue(item)) + ' 风华'; meta.appendChild(charm);
    meta.appendChild(makeMeta(item.rawType || item.type));
    meta.appendChild(makeMeta(freeClassification(item)));
    info.appendChild(meta);
    var acquisitionPath = document.createElement('p'); acquisitionPath.className = 'free-path'; acquisitionPath.textContent = '获取方式：' + (item.source || item.note || item.channel || '待补充'); info.appendChild(acquisitionPath);
    var exclusiveNote = createExclusiveChoiceNote(item); if (exclusiveNote) info.appendChild(exclusiveNote);
    if (!multiCopy) info.appendChild(createFreeToggle(item, '标记已获得', '已获得 ✓'));
    card.appendChild(info);
    if (multiCopy) card.appendChild(createFreeCopiesControl(item));
    return card;
  }

  function currentMissingFreeItems() {
    return freeCollectibles.filter(function (item) { return matchesFreeGender(item) && isCurrentlyAvailable(item) && !isFreeRequirementComplete(item); });
  }

  function renderFreeMissionSummary() {
    var progress = getFreeCharmProgress();
    el.freeMissionMissingCount.textContent = progress.remainingCount;
    el.freeMissionMissingCharm.textContent = formatNumber(progress.remainingCharm);
    el.freeMissionHint.textContent = '先选分类标签，再按外观大类和状态快速查找';
  }

  function renderFreeFilterOptions() {
    var sourceItems = freeItems.filter(function (item) { return item.recordShape !== '套装部件' && matchesFreeGender(item); });
    if (view.freeMode === 'lookup' && view.freeLookupClassification !== 'all') {
      sourceItems = sourceItems.filter(function (item) { return matchesFreeClassificationSelection(item, view.freeLookupClassification); });
    }
    var selectedFilter = activeFreeFilter();
    var classifications = ['all'].concat(FREE_CATALOG_TYPE_ORDER);
    el.freeFilters.replaceChildren();
    classifications.forEach(function (classification) {
      var count = classification === 'all' ? sourceItems.length : sourceItems.filter(function (item) {
        return freeCatalogType(item) === classification;
      }).length;
      if (classification !== 'all' && count === 0) return;
      var button = document.createElement('button'); button.type = 'button'; button.dataset.freeFilter = classification;
      button.className = 'category-option' + (classification === '套装' ? ' category-option-set' : '') + (selectedFilter === classification ? ' is-active' : '');
      button.innerHTML = '<span>' + escapeHtml(classification === 'all' ? '全部分类' : (FREE_CATALOG_TYPE_LABELS[classification] || classification)) + '</span><small>' + count + '</small><i>✓</i>';
      el.freeFilters.appendChild(button);
    });
    el.freeFilterKindLabel.textContent = '外观大类';
    el.freeFilterNote.textContent = '套装内的组件不计入其他筛选';
    el.freeFilters.setAttribute('aria-label', '按外观大类筛选免费风华');
  }

  function renderFreeRouteOptions() {
    var missing = currentMissingFreeItems();
    var selectedGroup = freeClassificationGroupForSelection(view.freeLookupClassification);
    el.freeRouteOptions.replaceChildren();
    [{ label: '全部', value: 'all' }].concat(FREE_CLASSIFICATION_GROUPS.map(function (group) {
      return { label: group.label, value: freeClassificationGroupValue(group), group: group };
    })).forEach(function (option) {
      var items = option.value === 'all' ? missing : missing.filter(function (item) { return matchesFreeClassificationSelection(item, option.value); });
      var remaining = summarizeFreeItems(items).remainingCount;
      var isActive = option.value === 'all' ? view.freeLookupClassification === 'all' : !!selectedGroup && selectedGroup.label === option.label;
      var button = document.createElement('button'); button.type = 'button'; button.dataset.freeClassification = option.value;
      button.className = 'free-route-option is-group' + (isActive ? ' is-active' : '');
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.innerHTML = '<span><b>' + escapeHtml(option.label) + '</b><small>' + remaining + '</small></span>';
      el.freeRouteOptions.appendChild(button);
    });
    el.freeRouteSubgroups.replaceChildren();
    if (!selectedGroup || !selectedGroup.children.length) {
      el.freeRouteSubgroups.hidden = true;
      return;
    }
    selectedGroup.children.forEach(function (classification) {
      var items = missing.filter(function (item) { return freeClassification(item) === classification; });
      var remaining = summarizeFreeItems(items).remainingCount;
      var button = document.createElement('button'); button.type = 'button'; button.dataset.freeClassification = classification;
      button.className = 'free-route-suboption' + (view.freeLookupClassification === classification ? ' is-active' : '');
      button.setAttribute('aria-pressed', view.freeLookupClassification === classification ? 'true' : 'false');
      button.innerHTML = '<span>' + escapeHtml(classification) + '</span><small>' + remaining + '</small>';
      el.freeRouteSubgroups.appendChild(button);
    });
    el.freeRouteSubgroups.hidden = false;
  }

  function freeModeCopy(visible) {
    var selectedFilter = activeFreeFilter();
    var selectedLabel = freeFilterLabel(selectedFilter);
    if (view.freeMode === 'lookup') return {
      title: view.freeLookupClassification === 'all' ? selectedLabel : freeClassificationSelectionLabel(view.freeLookupClassification) + ' · ' + selectedLabel,
      subtitle: view.freeMissingOnly ? '仅显示尚未标记获得的结果' : '按分类标签、外观大类和状态快速查找'
    };
    return { title: selectedFilter === 'all' ? '全部图鉴' : selectedLabel, subtitle: '按外观大类与风华值浏览已收录外观' };
  }

  function renderFreeModeChrome(visible) {
    var catalogMode = view.freeMode === 'catalog';
    el.freePage.dataset.freeMode = view.freeMode;
    el.freeMissionCard.hidden = true;
    el.freeProgressCard.hidden = !catalogMode;
    el.freeRoutePanel.hidden = view.freeMode !== 'lookup';
    el.freeSearchRow.hidden = view.freeMode !== 'lookup';
    el.freeMissingToggle.hidden = view.freeMode !== 'lookup';
    el.freeAvailabilityFilters.hidden = false;
    el.freeCatalogToolbar.hidden = false;
    el.freeModeSwitch.querySelectorAll('[data-free-mode]').forEach(function (button) {
      var active = button.dataset.freeMode === view.freeMode;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    el.freeMissingToggle.classList.toggle('is-active', view.freeMissingOnly);
    el.freeMissingToggle.setAttribute('aria-pressed', view.freeMissingOnly ? 'true' : 'false');
    el.freeMissingToggle.textContent = view.freeMissingOnly ? '仅看未获得' : '显示全部';
    var copy = freeModeCopy(visible);
    el.freeResultTitle.textContent = copy.title; el.freeResultSubtitle.textContent = copy.subtitle;
    renderFreeMissionSummary(); renderFreeRouteOptions();
  }

  function renderFreeList() {
    var visible = getVisibleFreeItems();
    var rendered = visible.slice(0, view.freeVisibleLimit);
    el.freeList.replaceChildren();
    rendered.forEach(function (item, index) {
      el.freeList.appendChild(item.recordShape === '套装' ? createFreeSetCard(item, index) : createFreeItemCard(item, index));
    });
    el.freeEmpty.hidden = visible.length > 0;
    el.freeEmpty.textContent = view.freeSearch ? '没有找到符合搜索条件的道具' : (view.freeGender === 'F' ? '女号' : '男号') + '在当前范围内没有待展示道具';
    renderFreeCharmProgress();
    var genderCollectibles = freeCollectibles.filter(matchesFreeGender);
    var genderSets = freeSets.filter(matchesFreeGender);
    el.freeCount.textContent = genderCollectibles.length; el.freeSetCount.textContent = genderSets.length;
    renderFreeFilterOptions();
    el.selectedFreeCategoryLabel.textContent = freeFilterLabel(activeFreeFilter());
    el.freeResultCount.textContent = rendered.length < visible.length ? '已显示 ' + rendered.length + '/' + visible.length + ' 件' : '共 ' + visible.length + ' 件';
    var remaining = Math.max(0, visible.length - rendered.length);
    el.freeLoadMoreButton.hidden = remaining === 0;
    el.freeLoadMoreButton.textContent = remaining > 0 ? '继续加载 ' + Math.min(FREE_PAGE_SIZE, remaining) + ' 件 · 还剩 ' + remaining + ' 件' : '已显示全部';
    var allOwned = visible.length > 0 && visible.every(isFreeRequirementComplete);
    el.selectFreeCategoryButton.disabled = visible.length === 0;
    el.selectFreeCategoryButton.classList.toggle('is-complete', allOwned);
    el.selectFreeCategoryButton.classList.remove('is-mixed');
    el.selectFreeCategoryButton.textContent = allOwned ? '取消全选' : '全选当前';
    renderFreeModeChrome(visible);
  }

  function switchFreeMode(mode) {
    if (['catalog', 'lookup'].indexOf(mode) < 0) return;
    view.freeMode = mode; view.freeVisibleLimit = FREE_PAGE_SIZE;
    setCategoryPanelOpen(false);
    renderFreeList();
  }

  function setCategoryPanelOpen(open) {
    el.categoryInlinePanel.hidden = !open;
    el.categoryPickerButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    el.categoryPickerButton.classList.toggle('is-open', open);
  }

  function toggleFreeSetParts(id) {
    view.expandedSets[id] = !view.expandedSets[id];
    renderFreeList();
    var nextButton = el.freeList.querySelector('.free-set-card[data-id="' + id + '"] [data-action="toggle-set-parts"]');
    if (nextButton) nextButton.focus();
  }

  function toggleCategoryPanel() {
    setCategoryPanelOpen(el.categoryInlinePanel.hidden);
  }

  function setStatus(id, status) {
    view.editingPaid[id] = true;
    var saved = ensureItemState(id); saved.status = saved.status === status ? '' : status; persist(); renderPaidList(); renderCalendarSelection();
  }

  function completePaidRecord(id) {
    if (!ensureItemState(id).status) { showToast('请先选择一项态度'); return; }
    delete view.editingPaid[id]; renderPaidList(); renderCalendarSelection(); showToast('记录已保存');
  }

  function editPaidRecord(id) {
    view.editingPaid[id] = true; renderPaidList(); renderCalendarSelection();
    window.setTimeout(function () { var input = document.querySelector('.outfit-card[data-id="' + id + '"] input[data-id="' + id + '"]'); if (input) input.focus(); }, 0);
  }

  function handlePaidCardAction(event) {
    var button = event.target.closest('[data-action]'); if (!button) return false;
    if (button.dataset.action === 'status') setStatus(button.dataset.id, button.dataset.status);
    else if (button.dataset.action === 'complete-record') completePaidRecord(button.dataset.id);
    else if (button.dataset.action === 'edit-record') editPaidRecord(button.dataset.id);
    else return false;
    return true;
  }

  function setReview(id, value) {
    ensureItemState(id).review = String(value || '').slice(0, 18); persist();
    document.querySelectorAll('input[data-id="' + id + '"]').forEach(function (input) {
      if (input.value !== value) input.value = String(value || '').slice(0, 18);
      input.parentElement.querySelector('small').textContent = input.value.length + '/18';
    });
  }

  function toggleFreeOwned(id) {
    var item = freeItemById[id];
    if (!item) return;
    var before = getFreeCharmProgress().allEarned; var target = !isFreeOwned(item);
    var cleared = [];
    if (item.recordShape === '套装') setFreeOwned(item, target);
    else cleared = setFreeOwnedCount(item, target ? maxFreeCopies(item) : 0);
    persist(); renderFreeList();
    var delta = Math.abs(getFreeCharmProgress().allEarned - before);
    if (cleared.length) showToast('已改选为' + item.name + '，并取消' + cleared.join('、'));
    else showToast(target ? '已记录 +' + formatNumber(delta) + ' 图鉴风华' : '已取消 ' + formatNumber(delta) + ' 图鉴风华');
  }

  function toggleFreeCopy(id, copyIndex, checked) {
    var item = freeItemById[id]; if (!item) return;
    var before = getFreeCharmProgress().allEarned;
    var current = getFreeOwnedCount(item);
    var target = checked ? Math.max(current, copyIndex) : Math.min(current, copyIndex - 1);
    setFreeOwnedCount(item, target); persist(); renderFreeList();
    var delta = Math.abs(getFreeCharmProgress().allEarned - before);
    showToast((target > current ? '已记录 +' : '已取消 ') + formatNumber(delta) + ' 风华 · ' + target + '/' + maxFreeCopies(item) + ' 件');
  }

  function toggleFreeCategorySelection() {
    var visible = getVisibleFreeItems(); if (!visible.length) return;
    var before = getFreeCharmProgress().allEarned;
    var allOwnedBefore = visible.every(isFreeRequirementComplete);
    var targetOwned = !allOwnedBefore;
    var processedGroups = {};
    visible.forEach(function (item) {
      var group = exclusiveGroupFor(item);
      if (group) {
        if (processedGroups[group]) return;
        processedGroups[group] = true;
        var selected = exclusiveSelectedItem(item);
        if (targetOwned && !selected) setFreeOwned(item, true);
        if (!targetOwned && selected) setFreeOwned(selected, false);
        return;
      }
      if (item.recordShape === '套装') {
        childrenForSet(item.id, true).forEach(function (child) {
          setFreeOwnedCount(child, targetOwned ? maxFreeCopies(child) : 0);
        });
        return;
      }
      setFreeOwnedCount(item, targetOwned ? maxFreeCopies(item) : 0);
    }); persist(); renderFreeList();
    var delta = Math.abs(getFreeCharmProgress().allEarned - before);
    if (targetOwned) showToast('本类已全选 · +' + formatNumber(delta) + ' 图鉴风华');
    else showToast('已取消本类 · ' + formatNumber(delta) + ' 图鉴风华');
  }

  function switchPage(page) {
    view.page = page;
    document.querySelectorAll('.page').forEach(function (node) { node.hidden = node.dataset.page !== page; });
    document.querySelectorAll('.nav-item').forEach(function (button) { button.classList.toggle('is-active', button.dataset.tab === page); });
    document.querySelector('.app-shell').classList.toggle('is-free-active', page === 'free');
    document.querySelector('.app-shell').classList.toggle('is-paid-list-active', page === 'calendar' && view.mode === 'list');
    window.scrollTo(0, 0);
  }

  function switchMode(mode) {
    view.mode = mode; el.calendarView.hidden = mode !== 'calendar'; el.listView.hidden = mode !== 'list';
    document.querySelector('.app-shell').classList.toggle('is-paid-list-active', view.page === 'calendar' && mode === 'list');
    el.viewSwitch.querySelectorAll('[data-view]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.view === mode); });
    if (mode === 'list') renderPaidList();
  }

  function getCounts(items) {
    var counts = { bought: 0, notBought: 0, regret: 0, missed: 0 };
    (items || paidItems).forEach(function (item) { var status = ensureItemState(item.id).status; if (status && counts[status] !== undefined) counts[status] += 1; });
    return counts;
  }

  function getReferenceDate() {
    var raw = window.OUTFIT_DATA_META && window.OUTFIT_DATA_META.paidLatestDate;
    var date = raw ? new Date(raw + 'T12:00:00') : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function getScopedPaidItems(scope) {
    var reference = new Date(view.calendarYear, view.calendarMonth, 1);
    return paidItems.filter(function (item) {
      if (scope === 'all') return true;
      var date = new Date(String(item.onSaleDate || '') + 'T12:00:00');
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== reference.getFullYear()) return false;
      if (scope === 'month') return date.getMonth() === reference.getMonth();
      return Math.floor(date.getMonth() / 3) === Math.floor(reference.getMonth() / 3);
    }).sort(function (a, b) { return String(a.onSaleDate || '').localeCompare(String(b.onSaleDate || '')); });
  }

  function buildSharePages() {
    var items = getFilteredPaidItems(); var details = [];
    shareState.filterLabel = paidRangeLabel(view.paidRange);
    for (var index = 0; index < items.length; index += 4) details.push(items.slice(index, index + 4));
    shareState.pages = [{ type: 'summary', items: items }].concat(details.map(function (pageItems, pageIndex) {
      return { type: 'detail', items: pageItems, detailIndex: pageIndex + 1, detailTotal: details.length };
    }));
    shareState.dataUrls = new Array(shareState.pages.length);
    if (shareState.page >= shareState.pages.length) shareState.page = shareState.pages.length - 1;
  }

  function paintShareBase(ctx) {
    var canvas = el.shareCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#f5eee3'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2b2722'; ctx.fillRect(54, 54, 972, 1332); ctx.fillStyle = '#fbf7ef'; ctx.fillRect(72, 72, 936, 1296);
  }

  function drawShareSummary(items) {
    var canvas = el.shareCanvas; var ctx = canvas.getContext('2d'); var counts = getCounts(items);
    var reviews = items.filter(function (item) { return Boolean(ensureItemState(item.id).review); });
    paintShareBase(ctx);
    ctx.fillStyle = '#8f493b'; ctx.font = '700 28px sans-serif'; ctx.fillText('燕 云 衣 事 通', 118, 148);
    ctx.fillStyle = '#2b2722'; ctx.font = '700 86px serif'; ctx.fillText('你孝了吗？', 116, 260);
    ctx.fillStyle = '#867c6f'; ctx.font = '28px sans-serif'; ctx.fillText('我的付费服装记录 · ' + shareState.filterLabel, 118, 312);
    var blocks = [[STATUS.bought, counts.bought, '#8f493b'], [STATUS.notBought, counts.notBought, '#557267'], [STATUS.regret, counts.regret, '#a8792f'], [STATUS.missed, counts.missed, '#625d55']];
    blocks.forEach(function (block, index) {
      var x = 116 + (index % 2) * 430; var y = 380 + Math.floor(index / 2) * 170;
      ctx.fillStyle = '#eee5d8'; roundRect(ctx, x, y, 394, 138, 24); ctx.fill();
      ctx.fillStyle = block[2]; ctx.font = '700 60px serif'; ctx.fillText(String(block[1]), x + 34, y + 78);
      ctx.fillStyle = '#514b43'; ctx.font = '700 28px sans-serif'; ctx.fillText(block[0], x + 150, y + 76);
    });
    ctx.fillStyle = '#2b2722'; ctx.font = '700 34px sans-serif'; ctx.fillText('我想说', 116, 770);
    ctx.fillStyle = '#cdbca4'; ctx.fillRect(116, 792, 848, 2);
    if (!reviews.length) {
      ctx.fillStyle = '#9b9287'; ctx.font = '28px sans-serif'; ctx.fillText('还没写短评，先去列表留下一句吧。', 116, 860);
    } else {
      reviews.slice(0, 4).forEach(function (item, index) {
        var y = 858 + index * 92; ctx.fillStyle = '#8f493b'; ctx.font = '700 25px sans-serif'; ctx.fillText(item.name, 116, y);
        ctx.fillStyle = '#514b43'; ctx.font = '27px sans-serif'; ctx.fillText('“' + ensureItemState(item.id).review + '”', 310, y);
      });
    }
    ctx.fillStyle = '#8f493b'; ctx.fillRect(116, 1260, 78, 8); ctx.fillStyle = '#766e64'; ctx.font = '24px sans-serif';
    ctx.fillText('本次筛选共 ' + items.length + ' 套外观', 116, 1320);
    ctx.textAlign = 'right'; ctx.font = '22px sans-serif'; ctx.fillText('制作者：薄荷小鹿（燕云十六声）', 964, 1320); ctx.textAlign = 'left';
  }

  function loadCanvasImage(source) {
    return new Promise(function (resolve) {
      if (!source) { resolve(null); return; }
      var image = new Image(); image.onload = function () { resolve(image); }; image.onerror = function () { resolve(null); }; image.src = source;
    });
  }

  function drawCoverImage(ctx, image, x, y, width, height) {
    var scale = Math.max(width / image.width, height / image.height); var sw = width / scale; var sh = height / scale;
    var sx = (image.width - sw) / 2; var sy = (image.height - sh) / 2;
    ctx.save(); roundRect(ctx, x, y, width, height, 12); ctx.clip(); ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height); ctx.restore();
  }

  function drawImagePlaceholder(ctx, x, y, width, height, label) {
    ctx.fillStyle = '#e7ddcd'; roundRect(ctx, x, y, width, height, 12); ctx.fill();
    ctx.strokeStyle = '#cdbca4'; ctx.lineWidth = 2; roundRect(ctx, x + 8, y + 8, width - 16, height - 16, 9); ctx.stroke();
    ctx.fillStyle = '#8c857b'; ctx.textAlign = 'center'; ctx.font = '24px sans-serif'; ctx.fillText('◇', x + width / 2, y + height / 2 - 2);
    ctx.font = '18px sans-serif'; ctx.fillText(label || '待补图', x + width / 2, y + height / 2 + 30); ctx.textAlign = 'left';
  }

  async function drawItemImages(ctx, item, x, y, width, height) {
    var common = item.commonImage ? await loadCanvasImage(item.commonImage) : null;
    if (common) { drawCoverImage(ctx, common, x, y, width, height); return; }
    var female = item.femaleImage ? await loadCanvasImage(item.femaleImage) : null;
    var male = item.maleImage ? await loadCanvasImage(item.maleImage) : null;
    if (female || male) {
      var gap = 8; var slot = (width - gap) / 2;
      if (female) drawCoverImage(ctx, female, x, y, slot, height); else drawImagePlaceholder(ctx, x, y, slot, height, '女号');
      if (male) drawCoverImage(ctx, male, x + slot + gap, y, slot, height); else drawImagePlaceholder(ctx, x + slot + gap, y, slot, height, '男号');
      return;
    }
    drawImagePlaceholder(ctx, x, y, width, height, '待补图');
  }

  function fitText(ctx, text, maxWidth) {
    var value = String(text || '');
    while (value.length > 1 && ctx.measureText(value).width > maxWidth) value = value.slice(0, -1);
    return value === String(text || '') ? value : value.slice(0, -1) + '…';
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var chars = String(text || '').split(''); var line = ''; var lines = [];
    chars.forEach(function (char) { var test = line + char; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char; } else line = test; });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function (entry, index) {
      var display = index === maxLines - 1 && lines.length > maxLines ? fitText(ctx, entry + '…', maxWidth) : entry;
      ctx.fillText(display, x, y + index * lineHeight);
    });
  }

  async function drawShareDetail(page) {
    var canvas = el.shareCanvas; var ctx = canvas.getContext('2d'); paintShareBase(ctx);
    ctx.fillStyle = '#8f493b'; ctx.font = '700 28px sans-serif'; ctx.fillText('燕 云 衣 事 通', 112, 142);
    ctx.fillStyle = '#2b2722'; ctx.font = '700 58px serif'; ctx.fillText('我的外观态度', 112, 218);
    ctx.fillStyle = '#867c6f'; ctx.font = '24px sans-serif'; ctx.fillText(shareState.filterLabel + ' · 明细 ' + page.detailIndex + '/' + page.detailTotal, 112, 262);
    for (var index = 0; index < page.items.length; index += 1) {
      var item = page.items[index]; var saved = ensureItemState(item.id); var top = 305 + index * 248;
      ctx.fillStyle = index % 2 ? '#f3ecdf' : '#eee4d5'; roundRect(ctx, 102, top, 876, 220, 20); ctx.fill();
      ctx.fillStyle = '#8f493b'; ctx.font = '700 26px Georgia, serif'; ctx.fillText(formatDate(item.onSaleDate), 128, top + 48);
      ctx.fillStyle = '#8c857b'; ctx.font = '20px sans-serif'; ctx.fillText(item.listingStatus || '状态待补', 128, top + 80);
      await drawItemImages(ctx, item, 270, top + 18, 230, 184);
      ctx.fillStyle = '#2b2722'; ctx.font = '700 34px sans-serif'; ctx.fillText(fitText(ctx, item.name, 245), 530, top + 48);
      ctx.fillStyle = '#8c857b'; ctx.font = '21px sans-serif'; ctx.fillText(fitText(ctx, (item.type || '待补') + ' · ' + (item.priceTier || '价格待补'), 250), 530, top + 82);
      var statusText = saved.status ? STATUS[saved.status] : '未选择';
      ctx.fillStyle = saved.status ? '#a85045' : '#8c857b'; ctx.font = '700 38px serif'; ctx.textAlign = 'right'; ctx.fillText(statusText, 944, top + 50); ctx.textAlign = 'left';
      ctx.strokeStyle = '#cdbca4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(530, top + 108); ctx.lineTo(944, top + 108); ctx.stroke();
      ctx.fillStyle = saved.review ? REVIEW_RED : '#9b9287'; ctx.font = '25px sans-serif';
      wrapText(ctx, saved.review ? '“' + saved.review + '”' : '暂未填写短评', 530, top + 151, 400, 34, 2);
    }
    if (!page.items.length) {
      ctx.fillStyle = '#8c857b'; ctx.textAlign = 'center'; ctx.font = '30px sans-serif'; ctx.fillText('这个日期范围内还没有服装记录', 540, 650); ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#8f493b'; ctx.fillRect(112, 1300, 78, 8); ctx.fillStyle = '#766e64'; ctx.font = '22px sans-serif';
    ctx.fillText('每一套外观，都留下一句自己的话', 112, 1350);
    ctx.textAlign = 'right'; ctx.fillText('制作者：薄荷小鹿（燕云十六声）', 964, 1350); ctx.textAlign = 'left';
  }

  async function drawSharePage(pageIndex) {
    shareState.page = Math.max(0, Math.min(pageIndex, shareState.pages.length - 1));
    var page = shareState.pages[shareState.page];
    el.sharePageTitle.textContent = page.type === 'summary' ? '总结报告' : '外观明细 ' + page.detailIndex;
    el.sharePageLabel.textContent = (shareState.page + 1) + ' / ' + shareState.pages.length;
    el.previousSharePage.disabled = shareState.page === 0; el.nextSharePage.disabled = shareState.page === shareState.pages.length - 1;
    el.saveAllShareButton.textContent = '保存全部 ' + shareState.pages.length + ' 张';
    if (page.type === 'summary') drawShareSummary(page.items); else await drawShareDetail(page);
    var dataUrl = el.shareCanvas.toDataURL('image/png'); shareState.dataUrls[shareState.page] = dataUrl;
    el.shareImage.hidden = true; return dataUrl;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath();
  }

  async function openShare() {
    if (!getFilteredPaidItems().length) { showToast('当前筛选没有可分享的服装'); return; }
    buildSharePages(); shareState.page = 0; el.shareBackdrop.hidden = false; await drawSharePage(0);
  }
  function closeShare() { el.shareBackdrop.hidden = true; }

  async function saveDataUrl(dataUrl) {
    var miniTool = window.xhs && window.xhs.miniTool;
    if (miniTool && typeof miniTool.writeTempFile === 'function' && typeof miniTool.saveImageToPhotosAlbum === 'function') {
      var file = await miniTool.writeTempFile({ data: dataUrl }); await miniTool.saveImageToPhotosAlbum({ filePath: file.filePath || dataUrl }); return true;
    }
    return false;
  }

  async function saveShare() {
    try {
      var dataUrl = shareState.dataUrls[shareState.page] || await drawSharePage(shareState.page);
      var saved = await saveDataUrl(dataUrl);
      el.shareImage.src = dataUrl; el.shareImage.hidden = false; showToast(saved ? '当前分享图已保存' : '预览已生成，请在小红书内保存');
    } catch (error) { showToast('保存失败，请检查相册权限'); }
  }

  async function saveAllShares() {
    try {
      var activePage = shareState.page;
      for (var index = 0; index < shareState.pages.length; index += 1) {
        var dataUrl = shareState.dataUrls[index] || await drawSharePage(index);
        if (!await saveDataUrl(dataUrl)) { await drawSharePage(activePage); showToast('预览已生成，请在小红书内保存'); return; }
      }
      await drawSharePage(activePage); showToast('已保存全部 ' + shareState.pages.length + ' 张分享图');
    } catch (error) { showToast('部分图片保存失败，请重试'); }
  }

  function formatDate(value) {
    if (!value) return '日期待补'; var parts = String(value).split('-');
    return parts.length === 3 ? Number(parts[1]) + '月' + Number(parts[2]) + '日' : String(value);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; });
  }
  function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
  function showToast(message) {
    window.clearTimeout(toastTimer); el.toast.textContent = message; el.toast.hidden = false;
    toastTimer = window.setTimeout(function () { el.toast.hidden = true; }, 2200);
  }

  el.viewSwitch.addEventListener('click', function (event) { var button = event.target.closest('[data-view]'); if (button) switchMode(button.dataset.view); });
  el.paidList.addEventListener('click', handlePaidCardAction);
  el.paidList.addEventListener('input', function (event) { if (event.target.matches('input[data-id]')) setReview(event.target.dataset.id, event.target.value); });
  el.paidSearchInput.addEventListener('input', function () { view.paidSearch = el.paidSearchInput.value.trim(); renderPaidList(); });
  el.paidRangeFilter.addEventListener('change', function () {
    view.paidRange = el.paidRangeFilter.value;
    el.paidCustomRange.hidden = view.paidRange !== 'custom'; el.paidRangeError.hidden = true;
    if (view.paidRange !== 'custom' || (view.paidStartDate && view.paidEndDate)) renderPaidList();
  });
  el.paidStatusFilter.addEventListener('change', function () { view.paidStatus = el.paidStatusFilter.value; renderPaidList(); });
  el.statusSummary.addEventListener('click', function (event) {
    var cell = event.target.closest('[data-status-filter]');
    if (!cell) return;
    var next = cell.dataset.statusFilter;
    view.paidRecordStatus = view.paidRecordStatus === next ? 'all' : next;
    renderPaidList();
  });
  el.paidMethodFilter.addEventListener('click', function () { setPaidMethodPanelOpen(el.paidMethodPanel.hidden); });
  el.paidMethodOptions.addEventListener('change', function () {
    view.paidMethods = Array.from(el.paidMethodOptions.querySelectorAll('input:checked')).map(function (input) { return input.value; });
    renderPaidMethodSummary(); renderPaidMethodRefinements(); renderPaidList();
  });
  el.paidMethodRefinements.addEventListener('change', function (event) {
    if (event.target === el.paidWheelVariantHair) view.paidWheelIncludeVariantHair = el.paidWheelVariantHair.checked;
    view.paidListeningTypes = Array.from(el.paidListeningOptions.querySelectorAll('input:checked')).map(function (input) { return input.value; });
    view.paidRetailPrices = Array.from(el.paidRetailPriceOptions.querySelectorAll('input:checked')).map(function (input) { return input.value; });
    view.paidHalfPricePrices = Array.from(el.paidHalfPriceOptions.querySelectorAll('input:checked')).map(function (input) { return input.value; });
    renderPaidMethodSummary(); renderPaidList();
  });
  el.clearPaidMethodsButton.addEventListener('click', function () {
    el.paidMethodOptions.querySelectorAll('input').forEach(function (input) { input.checked = false; });
    view.paidMethods = []; view.paidWheelIncludeVariantHair = true; view.paidListeningTypes = []; view.paidRetailPrices = []; view.paidHalfPricePrices = [];
    renderPaidMethodSummary(); renderPaidMethodRefinements(); renderPaidList();
  });
  el.applyPaidRangeButton.addEventListener('click', applyCustomPaidRange);
  [el.paidStartDate, el.paidEndDate].forEach(function (input) {
    input.addEventListener('change', function () { el.paidRangeError.hidden = true; });
  });
  el.calendarGrid.addEventListener('click', function (event) { var day = event.target.closest('[data-date]'); if (day) selectCalendarDate(day.dataset.date); });
  el.calendarMonthPicker.addEventListener('change', function () { setCalendarMonth(el.calendarMonthPicker.value); });
  el.previousMonthButton.addEventListener('click', function () { shiftCalendarMonth(-1); });
  el.nextMonthButton.addEventListener('click', function () { shiftCalendarMonth(1); });
  el.calendarTodayButton.addEventListener('click', goToToday);
  el.monthOverviewButton.addEventListener('click', function () { view.selectedDate = ''; renderCalendar(); });
  el.scheduleList.addEventListener('click', function (event) {
    if (handlePaidCardAction(event)) return;
    var schedule = event.target.closest('[data-schedule-date]'); if (schedule) selectCalendarDate(schedule.dataset.scheduleDate);
  });
  el.scheduleList.addEventListener('input', function (event) { if (event.target.matches('input[data-id]')) setReview(event.target.dataset.id, event.target.value); });
  el.freeModeSwitch.addEventListener('click', function (event) {
    var button = event.target.closest('[data-free-mode]'); if (button) switchFreeMode(button.dataset.freeMode);
  });
  el.freeRoutePanel.addEventListener('click', function (event) {
    var button = event.target.closest('[data-free-classification]'); if (!button) return;
    view.freeLookupClassification = button.dataset.freeClassification; view.freeVisibleLimit = FREE_PAGE_SIZE; renderFreeList();
  });
  el.freeSearchInput.addEventListener('input', function () {
    view.freeSearch = el.freeSearchInput.value.trim(); view.freeVisibleLimit = FREE_PAGE_SIZE; renderFreeList();
  });
  el.freeMissingToggle.addEventListener('click', function () {
    view.freeMissingOnly = !view.freeMissingOnly; view.freeVisibleLimit = FREE_PAGE_SIZE; renderFreeList();
  });
  el.freeFilters.addEventListener('click', function (event) {
    var button = event.target.closest('[data-free-filter]'); if (!button) return;
    view.freeCatalogFilter = button.dataset.freeFilter;
    view.freeVisibleLimit = FREE_PAGE_SIZE;
    el.freeFilters.querySelectorAll('button').forEach(function (entry) { entry.classList.toggle('is-active', entry === button); }); renderFreeList(); setCategoryPanelOpen(false); el.categoryPickerButton.focus();
  });
  el.freeAvailabilityFilters.addEventListener('click', function (event) {
    var button = event.target.closest('[data-free-availability]'); if (!button) return; view.freeAvailability = button.dataset.freeAvailability;
    view.freeVisibleLimit = FREE_PAGE_SIZE;
    el.freeAvailabilityFilters.querySelectorAll('button').forEach(function (entry) { entry.classList.toggle('is-active', entry === button); }); renderFreeList();
  });
  el.freeGenderSwitch.addEventListener('click', function (event) {
    var button = event.target.closest('[data-free-gender]'); if (button) switchFreeGender(button.dataset.freeGender);
  });
  el.freeProgressScope.addEventListener('click', function (event) { var button = event.target.closest('[data-progress-scope]'); if (button) switchFreeProgressScope(button.dataset.progressScope); });
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-action="image-preview"]');
    if (trigger) openImagePreview(trigger.dataset.previewSrc, trigger.dataset.previewAlt, trigger);
    if (!event.target.closest('.paid-method-picker')) setPaidMethodPanelOpen(false);
  });
  document.addEventListener('contextmenu', function (event) {
    if (event.target.closest('img, canvas, .image-preview-button, .item-visual')) event.preventDefault();
  }, true);
  document.addEventListener('dragstart', function (event) {
    if (event.target.closest('img, canvas, .image-preview-button, .item-visual')) event.preventDefault();
  }, true);
  el.closeImagePreviewButton.addEventListener('click', closeImagePreview);
  el.imagePreviewBackdrop.addEventListener('click', function (event) { if (event.target === el.imagePreviewBackdrop) closeImagePreview(); });
  el.categoryPickerButton.addEventListener('click', toggleCategoryPanel);
  el.selectFreeCategoryButton.addEventListener('click', toggleFreeCategorySelection);
  el.freeLoadMoreButton.addEventListener('click', function () { view.freeVisibleLimit += FREE_PAGE_SIZE; renderFreeList(); });
  el.freeList.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action]'); if (!button) return;
    if (button.dataset.action === 'free-owned') toggleFreeOwned(button.dataset.id);
    if (button.dataset.action === 'toggle-set-parts') toggleFreeSetParts(button.dataset.id);
  });
  el.freeList.addEventListener('change', function (event) {
    var input = event.target.closest('input[data-action="free-copy"]'); if (!input) return;
    toggleFreeCopy(input.dataset.id, Number(input.dataset.copyIndex), input.checked);
  });
  document.querySelectorAll('.nav-item').forEach(function (button) { button.addEventListener('click', function () { switchPage(button.dataset.tab); }); });
  el.generateShareButton.addEventListener('click', openShare); el.closeShareButton.addEventListener('click', closeShare);
  el.shareBackdrop.addEventListener('click', function (event) { if (event.target === el.shareBackdrop) closeShare(); });
  el.previousSharePage.addEventListener('click', function () { drawSharePage(shareState.page - 1); });
  el.nextSharePage.addEventListener('click', function () { drawSharePage(shareState.page + 1); });
  el.saveShareButton.addEventListener('click', saveShare); el.saveAllShareButton.addEventListener('click', saveAllShares);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (!el.imagePreviewBackdrop.hidden) closeImagePreview();
    else if (!el.paidMethodPanel.hidden) { setPaidMethodPanelOpen(false); el.paidMethodFilter.focus(); }
    else if (!el.categoryInlinePanel.hidden) { setCategoryPanelOpen(false); el.categoryPickerButton.focus(); }
  });

  // 预告只进入日历，不计入最终外观总数。
  el.paidCount.textContent = paidListItems.length;
  PAID_FILTER_ORDER.filter(function (method) { return paidListItems.some(function (item) { return paidFilterMethod(item) === method; }); }).forEach(function (method) {
    var label = document.createElement('label'); var input = document.createElement('input'); var text = document.createElement('span');
    input.type = 'checkbox'; input.value = method; text.textContent = method; label.appendChild(input); label.appendChild(text); el.paidMethodOptions.appendChild(label);
  });
  Array.from(new Set(paidListItems.filter(function (item) { return paidFilterMethod(item) === '原价直售'; }).map(function (item) { return item.priceOriginal; }).filter(Boolean))).sort(function (a, b) { return Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')); }).forEach(function (price) {
    var label = document.createElement('label'); var input = document.createElement('input'); var text = document.createElement('span');
    input.type = 'checkbox'; input.value = price; text.textContent = price; label.appendChild(input); label.appendChild(text); el.paidRetailPriceOptions.appendChild(label);
  });
  Array.from(new Set(paidListItems.filter(function (item) { return paidFilterMethod(item) === '限时半价'; }).map(function (item) { return item.priceOriginal; }).filter(Boolean))).sort(function (a, b) { return Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')); }).forEach(function (price) {
    var label = document.createElement('label'); var input = document.createElement('input'); var text = document.createElement('span');
    input.type = 'checkbox'; input.value = price; text.textContent = price; label.appendChild(input); label.appendChild(text); el.paidHalfPriceOptions.appendChild(label);
  });
  renderPaidMethodSummary(); renderPaidMethodRefinements();
  el.freeGenderSwitch.querySelectorAll('[data-free-gender]').forEach(function (button) {
    var active = button.dataset.freeGender === view.freeGender;
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  renderCalendar(); renderPaidList(); renderFreeList(); scheduleFreeDateRefresh();
  window.__OUTFIT_APP__ = {
    version: '1.0.0-formal-release', storageKey: STORAGE_KEY, paidCount: paidListItems.length, paidListCount: paidListItems.length, calendarPaidCount: paidItems.length, freeCount: freeCollectibles.length, freeDatabaseRows: freeItems.length, freeSetCount: freeSets.length,
    getState: function () { return JSON.parse(JSON.stringify(state)); }, getCounts: getCounts,
    setStatus: setStatus, setReview: setReview, switchMode: switchMode, switchPage: switchPage,
    getScopedPaidItems: getScopedPaidItems, getFilteredPaidItems: getFilteredPaidItems, paidItemMatchesMethodRefinements: paidItemMatchesMethodRefinements, buildSharePages: buildSharePages, drawSharePage: drawSharePage,
    setCalendarMonth: setCalendarMonth, selectCalendarDate: selectCalendarDate, goToToday: goToToday, paidEventsForMonth: paidEventsForMonth, paidValueRank: paidValueRank, comparePaidSameDate: comparePaidSameDate, getPaidBundleMap: getPaidBundleMap, paidFilterMethod: paidFilterMethod, paidItemMatchesRange: paidItemMatchesRange, applyCustomPaidRange: applyCustomPaidRange, toggleFreeCategorySelection: toggleFreeCategorySelection,
    getVisibleFreeItems: getVisibleFreeItems, getFreeCharmProgress: getFreeCharmProgress, getFreeOwnedCount: getFreeOwnedCount, setFreeOwnedCount: setFreeOwnedCount, summarizeFreeItems: summarizeFreeItems, switchFreeMode: switchFreeMode, switchFreeProgressScope: switchFreeProgressScope, switchFreeGender: switchFreeGender, toggleFreeOwned: toggleFreeOwned, toggleFreeCopy: toggleFreeCopy, toggleFreeSetParts: toggleFreeSetParts, childrenForSet: childrenForSet, freeDaysRemaining: freeDaysRemaining, effectiveFreeStatus: effectiveFreeStatus, freeStatusLabel: freeStatusLabel,
    completePaidRecord: completePaidRecord, editPaidRecord: editPaidRecord, openImagePreview: openImagePreview, closeImagePreview: closeImagePreview
  };
  var appBoot = document.getElementById('appBoot');
  if (appBoot) appBoot.hidden = true;
}());
